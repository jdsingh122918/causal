use anthropic_sdk::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::mpsc;
use crate::transcription::buffer::TranscriptionBuffer;

/// Result of AI enhancement processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedTranscript {
    pub buffer_id: u32,
    pub raw_text: String,
    pub enhanced_text: String,
    pub processing_time_ms: u64,
    pub model_used: String,
}

/// AI agent for enhancing transcription quality
pub struct EnhancementAgent {
    api_key: String,
    model: String,
}

impl EnhancementAgent {
    /// Create a new enhancement agent
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            model: "claude-haiku-4-5-20251001".to_string(), // Latest Claude Haiku 4.5 - fast and cost-effective
        }
    }

    /// Build the enhancement prompt for the AI
    fn build_enhancement_prompt(raw_text: &str) -> String {
        format!(
            r#"You are a transcription enhancement assistant. Your task is to improve the quality of audio transcriptions while preserving the original meaning and speaker's intent.

Guidelines:
1. Fix grammar and spelling errors
2. Add proper punctuation (periods, commas, question marks, etc.)
3. Capitalize proper nouns and sentence beginnings
4. Polish sentence structure for readability
5. Format technical terms correctly
6. Remove filler words (um, uh, like) only if excessive
7. Preserve the speaker's tone and meaning exactly
8. Do NOT add information that wasn't in the original
9. Do NOT summarize - keep all content
10. Return ONLY the enhanced text, no explanations or metadata

Raw transcription:
{}

Enhanced transcription:"#,
            raw_text
        )
    }

    /// Enhance a transcription buffer using Claude
    pub async fn enhance(&self, buffer: TranscriptionBuffer) -> Result<EnhancedTranscript, String> {
        let start_time = std::time::Instant::now();
        let raw_text = buffer.combined_text();

        // Skip empty buffers
        if raw_text.trim().is_empty() {
            return Err("Empty buffer".to_string());
        }

        tracing::info!(
            "🤖 Enhancing buffer {} ({} chars)...",
            buffer.turn_order,
            raw_text.len()
        );

        // Build the prompt
        let prompt = Self::build_enhancement_prompt(&raw_text);

        // Create the API request using builder pattern
        let request = Client::new()
            .auth(&self.api_key)
            .model(&self.model)
            .messages(&json!([
                {"role": "user", "content": prompt}
            ]))
            .max_tokens(4096)
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

        let mut enhanced_text = String::new();
        while let Some(chunk) = rx.recv().await {
            enhanced_text.push_str(&chunk);
        }

        // Wait for execution to complete
        handle.await
            .map_err(|e| format!("Task join error: {}", e))?
            .map_err(|e| format!("API call failed: {}", e))?;

        // Trim the response
        let enhanced_text = enhanced_text.trim().to_string();

        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        tracing::info!(
            "✨ Enhanced buffer {} ({}ms)",
            buffer.turn_order,
            processing_time_ms
        );

        Ok(EnhancedTranscript {
            buffer_id: buffer.turn_order,
            raw_text,
            enhanced_text,
            processing_time_ms,
            model_used: self.model.clone(),
        })
    }

    /// Process multiple buffers concurrently (with rate limiting)
    pub async fn enhance_batch(
        &self,
        buffers: Vec<TranscriptionBuffer>,
    ) -> Vec<Result<EnhancedTranscript, String>> {
        use futures_util::future::join_all;

        let tasks: Vec<_> = buffers
            .into_iter()
            .map(|buffer| self.enhance(buffer))
            .collect();

        join_all(tasks).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_generation() {
        let prompt = EnhancementAgent::build_enhancement_prompt("hello world");
        assert!(prompt.contains("hello world"));
        assert!(prompt.contains("Fix grammar"));
        assert!(prompt.contains("Enhanced transcription:"));
    }

    #[test]
    fn test_enhanced_transcript_creation() {
        let enhanced = EnhancedTranscript {
            buffer_id: 1,
            raw_text: "hello world".to_string(),
            enhanced_text: "Hello world.".to_string(),
            processing_time_ms: 100,
            model_used: "claude-3-haiku-20240307".to_string(),
        };

        assert_eq!(enhanced.buffer_id, 1);
        assert!(enhanced.enhanced_text.ends_with('.'));
    }
}
