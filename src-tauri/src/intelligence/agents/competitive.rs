use crate::intelligence::types::*;
use crate::transcription::buffer::TranscriptionBuffer;
use anthropic_sdk::Client;
use async_trait::async_trait;
use serde_json::json;
use tokio::sync::mpsc;

/// AI agent specialized in competitive intelligence and market positioning analysis
pub struct CompetitiveAgent {
    api_key: String,
    model: String,
}

impl CompetitiveAgent {
    /// Create a new competitive analysis agent
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            model: "claude-haiku-4-5-20251001".to_string(),
        }
    }

    /// Build the competitive analysis prompt
    fn build_competitive_prompt(text: &str) -> String {
        format!(
            r#"You are a competitive intelligence expert specializing in earnings calls and business communications. Analyze the following transcript segment for competitive mentions, market positioning, and strategic insights.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no explanations, no preamble, no markdown
2. Use the EXACT format specified below
3. Extract company/competitor names accurately
4. Identify competitive positioning statements
5. Look for market share, competitive advantages, and threats

Analyze for:
- Competitors mentioned by name (companies, products, services)
- Competitive positioning statements
- Market share references
- Claimed competitive advantages
- Identified competitive threats or challenges

Text to analyze:
{text}

Required JSON format:
{{
  "competitors_mentioned": ["Apple", "Google", "Microsoft"],
  "competitive_positioning": "We differentiate through superior customer service and innovation",
  "market_share_mentions": ["leading market position", "gained 3% market share"],
  "competitive_advantages": ["proprietary technology", "exclusive partnerships", "cost leadership"],
  "threats_identified": ["increased competition in mobile", "new entrant in cloud services"]
}}

Rules:
- competitors_mentioned: List company/brand names mentioned as competitors
- competitive_positioning: Single string summarizing how company positions vs competitors (or null)
- market_share_mentions: List phrases about market share, position, or ranking
- competitive_advantages: List claimed advantages or differentiators
- threats_identified: List competitive threats or challenges mentioned

JSON response:"#,
            text = text
        )
    }

    /// Parse competitive analysis response from API
    fn parse_competitive_response(response: &str) -> Result<CompetitiveAnalysis, String> {
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
            .map_err(|e| format!("Failed to parse competitive JSON: {}", e))?;

        // Extract competitors mentioned
        let competitors_mentioned = parsed
            .get("competitors_mentioned")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract competitive positioning
        let competitive_positioning = parsed
            .get("competitive_positioning")
            .and_then(|v| {
                if v.is_null() {
                    None
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            });

        // Extract market share mentions
        let market_share_mentions = parsed
            .get("market_share_mentions")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract competitive advantages
        let competitive_advantages = parsed
            .get("competitive_advantages")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract threats identified
        let threats_identified = parsed
            .get("threats_identified")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        Ok(CompetitiveAnalysis {
            competitors_mentioned,
            competitive_positioning,
            market_share_mentions,
            competitive_advantages,
            threats_identified,
        })
    }
}

#[async_trait]
impl IntelligenceAgent for CompetitiveAgent {
    async fn analyze(&self, buffer: &TranscriptionBuffer) -> Result<IntelligenceResult, String> {
        let start_time = std::time::Instant::now();
        let raw_text = buffer.combined_text();

        // Skip empty buffers
        if raw_text.trim().is_empty() {
            return Err("Empty buffer for competitive analysis".to_string());
        }

        tracing::debug!(
            "🏆 Analyzing competitive intelligence for buffer {} ({} chars)",
            buffer.turn_order,
            raw_text.len()
        );

        // Build the prompt
        let prompt = Self::build_competitive_prompt(&raw_text);

        // Create the API request
        let request = Client::new()
            .auth(&self.api_key)
            .model(&self.model)
            .messages(&json!([
                {"role": "user", "content": prompt}
            ]))
            .max_tokens(2048)
            .temperature(0.2) // Slightly higher temperature for better entity recognition
            .build()
            .map_err(|e| format!("Failed to build competitive request: {}", e))?;

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

        // Parse the competitive analysis
        let competitive_analysis = Self::parse_competitive_response(&response_text)?;

        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        tracing::debug!(
            "🏆 Competitive analysis complete for buffer {} ({}ms): {} competitors, {} advantages",
            buffer.turn_order,
            processing_time_ms,
            competitive_analysis.competitors_mentioned.len(),
            competitive_analysis.competitive_advantages.len()
        );

        Ok(IntelligenceResult {
            buffer_id: buffer.turn_order,
            analysis_type: AnalysisType::Competitive,
            processing_time_ms,
            model_used: self.model.clone(),
            raw_text,
            timestamp: chrono::Utc::now(),
            sentiment: None,
            financial: None,
            competitive: Some(competitive_analysis),
            summary: None,
            risk: None,
        })
    }

    fn analysis_type(&self) -> AnalysisType {
        AnalysisType::Competitive
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
        let prompt = CompetitiveAgent::build_competitive_prompt("We compete with Apple and Google");
        assert!(prompt.contains("We compete with Apple and Google"));
        assert!(prompt.contains("competitive intelligence"));
        assert!(prompt.contains("competitors_mentioned"));
    }

    #[test]
    fn test_parse_competitive_response() {
        let response = r#"{
            "competitors_mentioned": ["Apple", "Google"],
            "competitive_positioning": "We lead through innovation",
            "market_share_mentions": ["market leader", "gained 5% share"],
            "competitive_advantages": ["proprietary tech", "cost leadership"],
            "threats_identified": ["new entrants", "price competition"]
        }"#;

        let result = CompetitiveAgent::parse_competitive_response(response).unwrap();
        assert_eq!(result.competitors_mentioned.len(), 2);
        assert_eq!(result.competitive_positioning, Some("We lead through innovation".to_string()));
        assert_eq!(result.market_share_mentions.len(), 2);
        assert_eq!(result.competitive_advantages.len(), 2);
        assert_eq!(result.threats_identified.len(), 2);
    }

    #[test]
    fn test_parse_competitive_with_null_positioning() {
        let response = r#"{
            "competitors_mentioned": [],
            "competitive_positioning": null,
            "market_share_mentions": [],
            "competitive_advantages": [],
            "threats_identified": []
        }"#;

        let result = CompetitiveAgent::parse_competitive_response(response).unwrap();
        assert!(result.competitive_positioning.is_none());
        assert!(result.competitors_mentioned.is_empty());
    }

    #[test]
    fn test_parse_with_markdown() {
        let response = r#"```json
{
  "competitors_mentioned": ["Microsoft"],
  "competitive_positioning": "Superior customer service",
  "market_share_mentions": ["market position"],
  "competitive_advantages": ["innovation"],
  "threats_identified": ["competition"]
}
```"#;

        let result = CompetitiveAgent::parse_competitive_response(response).unwrap();
        assert_eq!(result.competitors_mentioned[0], "Microsoft");
        assert_eq!(result.competitive_positioning, Some("Superior customer service".to_string()));
    }

    #[test]
    fn test_empty_arrays() {
        let response = r#"{
            "competitors_mentioned": [],
            "competitive_positioning": "No specific positioning",
            "market_share_mentions": [],
            "competitive_advantages": [],
            "threats_identified": []
        }"#;

        let result = CompetitiveAgent::parse_competitive_response(response).unwrap();
        assert!(result.competitors_mentioned.is_empty());
        assert!(result.market_share_mentions.is_empty());
        assert!(result.competitive_advantages.is_empty());
        assert!(result.threats_identified.is_empty());
    }
}