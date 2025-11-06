use crate::intelligence::types::*;
use crate::transcription::buffer::TranscriptionBuffer;
use anthropic_sdk::Client;
use async_trait::async_trait;
use serde_json::json;
use tokio::sync::mpsc;

/// AI agent specialized in sentiment and emotional tone analysis
pub struct SentimentAgent {
    api_key: String,
    model: String,
}

impl SentimentAgent {
    /// Create a new sentiment analysis agent
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            model: "claude-haiku-4-5-20251001".to_string(),
        }
    }

    /// Build the sentiment analysis prompt
    fn build_sentiment_prompt(text: &str) -> String {
        format!(
            r#"You are a business sentiment analysis expert specializing in earnings calls, meetings, and business communications. Analyze the emotional tone and sentiment of the following transcript segment.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no explanations, no preamble, no markdown
2. Use the EXACT format specified below
3. Confidence scores must be between 0.0 and 1.0
4. Overall sentiment must be one of: "positive", "negative", "neutral"

Analyze for:
- Overall sentiment (positive/negative/neutral)
- Confidence level (0.0 to 1.0)
- Emotional tones present (confident, uncertain, optimistic, pessimistic, excited, concerned, defensive, aggressive)
- Key phrases that drove the sentiment assessment

Text to analyze:
{text}

Required JSON format:
{{
  "overall_sentiment": "positive|negative|neutral",
  "confidence": 0.85,
  "emotional_tone": ["confident", "optimistic"],
  "key_phrases": ["strong performance", "exceeded expectations"]
}}

JSON response:"#,
            text = text
        )
    }

    /// Parse sentiment analysis response from API
    fn parse_sentiment_response(response: &str) -> Result<SentimentAnalysis, String> {
        // Clean the response - remove any markdown formatting
        let cleaned = response
            .trim()
            .strip_prefix("```json")
            .unwrap_or(response)
            .strip_suffix("```")
            .unwrap_or(response)
            .trim();

        // Parse JSON
        let parsed: serde_json::Value = serde_json::from_str(cleaned)
            .map_err(|e| format!("Failed to parse sentiment JSON: {}", e))?;

        // Extract required fields
        let overall_sentiment = parsed
            .get("overall_sentiment")
            .and_then(|v| v.as_str())
            .ok_or("Missing overall_sentiment field")?
            .to_string();

        let confidence = parsed
            .get("confidence")
            .and_then(|v| v.as_f64())
            .ok_or("Missing confidence field")? as f32;

        let emotional_tone = parsed
            .get("emotional_tone")
            .and_then(|v| v.as_array())
            .ok_or("Missing emotional_tone field")?
            .iter()
            .map(|v| v.as_str().unwrap_or("").to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let key_phrases = parsed
            .get("key_phrases")
            .and_then(|v| v.as_array())
            .ok_or("Missing key_phrases field")?
            .iter()
            .map(|v| v.as_str().unwrap_or("").to_string())
            .filter(|s| !s.is_empty())
            .collect();

        // Validate sentiment value
        if !["positive", "negative", "neutral"].contains(&overall_sentiment.as_str()) {
            return Err(format!("Invalid sentiment value: {}", overall_sentiment));
        }

        // Validate confidence range
        if !(0.0..=1.0).contains(&confidence) {
            return Err(format!("Confidence must be 0.0-1.0, got: {}", confidence));
        }

        Ok(SentimentAnalysis {
            overall_sentiment,
            confidence,
            emotional_tone,
            key_phrases,
        })
    }
}

#[async_trait]
impl IntelligenceAgent for SentimentAgent {
    async fn analyze(&self, buffer: &TranscriptionBuffer) -> Result<IntelligenceResult, String> {
        let start_time = std::time::Instant::now();
        let raw_text = buffer.combined_text();

        // Skip empty buffers
        if raw_text.trim().is_empty() {
            return Err("Empty buffer for sentiment analysis".to_string());
        }

        tracing::debug!(
            "🎭 Analyzing sentiment for buffer {} ({} chars)",
            buffer.turn_order,
            raw_text.len()
        );

        // Build the prompt
        let prompt = Self::build_sentiment_prompt(&raw_text);

        // Create the API request
        let request = Client::new()
            .auth(&self.api_key)
            .model(&self.model)
            .messages(&json!([
                {"role": "user", "content": prompt}
            ]))
            .max_tokens(2048)
            .temperature(0.1) // Low temperature for consistent structured output
            .build()
            .map_err(|e| format!("Failed to build sentiment request: {}", e))?;

        // Execute API call and collect response
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();

        let execute_future = request.execute(move |text| {
            let tx = tx.clone();
            async move {
                let _ = tx.send(text.to_string());
            }
        });

        let handle = tokio::spawn(execute_future);

        let mut response_text = String::new();
        while let Some(chunk) = rx.recv().await {
            response_text.push_str(&chunk);
        }

        // Wait for execution to complete
        handle
            .await
            .map_err(|e| format!("Task join error: {}", e))?
            .map_err(|e| format!("API call failed: {}", e))?;

        // Parse the sentiment analysis
        let sentiment_analysis = Self::parse_sentiment_response(&response_text)?;

        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        tracing::debug!(
            "🎭 Sentiment analysis complete for buffer {} ({}ms): {} confidence={:.2}",
            buffer.turn_order,
            processing_time_ms,
            sentiment_analysis.overall_sentiment,
            sentiment_analysis.confidence
        );

        Ok(IntelligenceResult {
            buffer_id: buffer.turn_order,
            analysis_type: AnalysisType::Sentiment,
            processing_time_ms,
            model_used: self.model.clone(),
            raw_text,
            timestamp: chrono::Utc::now(),
            sentiment: Some(sentiment_analysis),
            financial: None,
            competitive: None,
            summary: None,
            risk: None,
        })
    }

    fn analysis_type(&self) -> AnalysisType {
        AnalysisType::Sentiment
    }

    fn model(&self) -> &str {
        &self.model
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_generation() {
        let prompt = SentimentAgent::build_sentiment_prompt("Great quarter!");
        assert!(prompt.contains("Great quarter!"));
        assert!(prompt.contains("sentiment analysis"));
        assert!(prompt.contains("JSON"));
    }

    #[test]
    fn test_parse_sentiment_response() {
        let response = r#"{
            "overall_sentiment": "positive",
            "confidence": 0.85,
            "emotional_tone": ["confident", "optimistic"],
            "key_phrases": ["great quarter", "exceeded expectations"]
        }"#;

        let result = SentimentAgent::parse_sentiment_response(response).unwrap();
        assert_eq!(result.overall_sentiment, "positive");
        assert_eq!(result.confidence, 0.85);
        assert_eq!(result.emotional_tone.len(), 2);
        assert_eq!(result.key_phrases.len(), 2);
    }

    #[test]
    fn test_parse_sentiment_with_markdown() {
        let response = r#"```json
{
  "overall_sentiment": "negative",
  "confidence": 0.75,
  "emotional_tone": ["concerned", "defensive"],
  "key_phrases": ["challenging market", "headwinds"]
}
```"#;

        let result = SentimentAgent::parse_sentiment_response(response).unwrap();
        assert_eq!(result.overall_sentiment, "negative");
        assert_eq!(result.confidence, 0.75);
    }

    #[test]
    fn test_invalid_sentiment_value() {
        let response = r#"{
            "overall_sentiment": "invalid",
            "confidence": 0.85,
            "emotional_tone": [],
            "key_phrases": []
        }"#;

        assert!(SentimentAgent::parse_sentiment_response(response).is_err());
    }

    #[test]
    fn test_invalid_confidence_range() {
        let response = r#"{
            "overall_sentiment": "positive",
            "confidence": 1.5,
            "emotional_tone": [],
            "key_phrases": []
        }"#;

        assert!(SentimentAgent::parse_sentiment_response(response).is_err());
    }
}