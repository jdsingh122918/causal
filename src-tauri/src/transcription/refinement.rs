use anthropic_sdk::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::mpsc;

/// Result of full-transcript refinement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefinedTranscript {
    pub raw_text: String,
    pub refined_text: String,
    pub processing_time_ms: u64,
    pub model_used: String,
    pub word_count: usize,
}

/// AI agent for refining full transcripts into coherent, readable text
pub struct RefinementAgent {
    api_key: String,
    model: String,
}

impl RefinementAgent {
    /// Create a new refinement agent
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            model: "claude-haiku-4-5-20251001".to_string(), // Fast Haiku for quick refinement
        }
    }

    /// Build the refinement prompt for the AI
    fn build_refinement_prompt(transcript: &str) -> String {
        format!(
            r#"You are a professional transcript editor. Your task is to refine this raw speech-to-text transcript into clear, readable text while preserving all information and meaning.

Guidelines:
1. Fix grammar, punctuation, and capitalization errors
2. Break long run-on sentences into clear, concise sentences
3. Add paragraph breaks for better readability (use double newlines)
4. Fix word boundaries and run-together words (e.g., "fc supervised" → "FSD supervised")
5. Correct obvious transcription errors while preserving technical terms
6. Format numbers and measurements correctly (e.g., "a million miles" → "1 million miles")
7. Add proper punctuation for clarity (commas, periods, question marks)
8. Preserve speaker intent and meaning exactly - do NOT summarize or omit content
9. Format product names correctly (e.g., "megapack" → "Megapack", "powerwall" → "Powerwall")
10. Do NOT add information that wasn't spoken
11. Return ONLY the refined transcript, no explanations or metadata

Raw transcript:
{}

Refined transcript:"#,
            transcript
        )
    }

    /// Refine the full transcript for better readability
    pub async fn refine(&self, raw_text: String) -> Result<RefinedTranscript, String> {
        let start_time = std::time::Instant::now();

        // Skip empty transcripts
        if raw_text.trim().is_empty() {
            return Err("Empty transcript".to_string());
        }

        let word_count = raw_text.split_whitespace().count();

        tracing::info!(
            "🎨 REFINING FULL TRANSCRIPT - {} words, {} chars",
            word_count,
            raw_text.len()
        );

        // Build the prompt
        let prompt = Self::build_refinement_prompt(&raw_text);

        // Create the API request using builder pattern
        let request = Client::new()
            .auth(&self.api_key)
            .model(&self.model)
            .messages(&json!([
                {"role": "user", "content": prompt}
            ]))
            .max_tokens(8192) // Allow for longer transcripts
            .temperature(0.3) // Lower temperature for more consistent output
            .build()
            .map_err(|e| format!("Failed to build request: {}", e))?;

        // Call the API and collect response text using a channel
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();

        let execute_future = request.execute(move |text| {
            let tx = tx.clone();
            async move {
                let _ = tx.send(text.to_string());
            }
        });

        // Spawn the execution and collect results
        let handle = tokio::spawn(execute_future);

        let mut refined_text = String::new();
        while let Some(chunk) = rx.recv().await {
            refined_text.push_str(&chunk);
        }

        // Wait for execution to complete
        handle.await
            .map_err(|e| format!("Task join error: {}", e))?
            .map_err(|e| format!("API call failed: {}", e))?;

        // Trim the response
        let refined_text = refined_text.trim().to_string();

        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        tracing::info!(
            "✨ TRANSCRIPT REFINED - {}ms, {} → {} words",
            processing_time_ms,
            word_count,
            refined_text.split_whitespace().count()
        );

        Ok(RefinedTranscript {
            raw_text,
            refined_text,
            processing_time_ms,
            model_used: self.model.clone(),
            word_count,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_generation() {
        let prompt = RefinementAgent::build_refinement_prompt("hello world test");
        assert!(prompt.contains("hello world test"));
        assert!(prompt.contains("Fix grammar"));
        assert!(prompt.contains("Refined transcript:"));
    }

    #[test]
    fn test_refined_transcript_creation() {
        let refined = RefinedTranscript {
            raw_text: "hello world".to_string(),
            refined_text: "Hello world.".to_string(),
            processing_time_ms: 100,
            model_used: "claude-haiku-4-5-20251001".to_string(),
            word_count: 2,
        };

        assert_eq!(refined.word_count, 2);
        assert!(refined.refined_text.ends_with('.'));
    }
}
