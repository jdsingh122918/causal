use crate::intelligence::types::*;
use crate::transcription::buffer::TranscriptionBuffer;
use anthropic_sdk::Client;
use async_trait::async_trait;
use serde_json::json;
use tokio::sync::mpsc;

/// AI agent specialized in summarization and key insights extraction
pub struct SummaryAgent {
    api_key: String,
    model: String,
}

impl SummaryAgent {
    /// Create a new summary analysis agent
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            model: "claude-haiku-4-5-20251001".to_string(),
        }
    }

    /// Build the summary analysis prompt
    fn build_summary_prompt(text: &str) -> String {
        format!(
            r#"You are a business intelligence expert specializing in extracting key insights and actionable information from earnings calls and business communications. Analyze the following transcript segment for main takeaways, decisions, and business impact.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no explanations, no preamble, no markdown
2. Use the EXACT format specified below
3. Focus on actionable insights and business impact
4. Identify decisions made and follow-up items

Analyze for:
- Key points and main takeaways
- Action items or next steps mentioned
- Decisions made or announced
- Business impact assessment
- Items requiring follow-up

Text to analyze:
{text}

Required JSON format:
{{
  "key_points": ["Revenue exceeded expectations", "Expanding into new markets", "Hiring 500 new employees"],
  "action_items": ["Launch marketing campaign", "Complete acquisition by Q3", "Improve customer support"],
  "decisions_made": ["Approved budget increase", "Selected new vendor", "Postponed product launch"],
  "business_impact": "Positive - strong growth trajectory with expanding market presence",
  "follow_up_required": ["Board approval needed", "Legal review pending", "Customer feedback analysis"]
}}

Rules:
- key_points: Main business insights and takeaways (3-5 items)
- action_items: Specific actionable tasks or initiatives mentioned
- decisions_made: Explicit decisions announced or made
- business_impact: Single assessment of overall business impact (or null if unclear)
- follow_up_required: Items that need additional attention or approval

JSON response:"#,
            text = text
        )
    }

    /// Parse summary analysis response from API
    fn parse_summary_response(response: &str) -> Result<SummaryAnalysis, String> {
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
            .map_err(|e| format!("Failed to parse summary JSON: {}", e))?;

        // Extract key points
        let key_points = parsed
            .get("key_points")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract action items
        let action_items = parsed
            .get("action_items")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract decisions made
        let decisions_made = parsed
            .get("decisions_made")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract business impact
        let business_impact = parsed
            .get("business_impact")
            .and_then(|v| {
                if v.is_null() {
                    None
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            });

        // Extract follow-up required
        let follow_up_required = parsed
            .get("follow_up_required")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        Ok(SummaryAnalysis {
            key_points,
            action_items,
            decisions_made,
            business_impact,
            follow_up_required,
        })
    }
}

#[async_trait]
impl IntelligenceAgent for SummaryAgent {
    async fn analyze(&self, buffer: &TranscriptionBuffer) -> Result<IntelligenceResult, String> {
        let start_time = std::time::Instant::now();
        let raw_text = buffer.combined_text();

        // Skip empty buffers
        if raw_text.trim().is_empty() {
            return Err("Empty buffer for summary analysis".to_string());
        }

        tracing::debug!(
            "📋 Analyzing key insights for buffer {} ({} chars)",
            buffer.turn_order,
            raw_text.len()
        );

        // Build the prompt
        let prompt = Self::build_summary_prompt(&raw_text);

        // Create the API request
        let request = Client::new()
            .auth(&self.api_key)
            .model(&self.model)
            .messages(&json!([
                {"role": "user", "content": prompt}
            ]))
            .max_tokens(2048)
            .temperature(0.3) // Moderate temperature for good insight extraction
            .build()
            .map_err(|e| format!("Failed to build summary request: {}", e))?;

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

        // Parse the summary analysis
        let summary_analysis = Self::parse_summary_response(&response_text)?;

        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        tracing::debug!(
            "📋 Summary analysis complete for buffer {} ({}ms): {} key points, {} actions",
            buffer.turn_order,
            processing_time_ms,
            summary_analysis.key_points.len(),
            summary_analysis.action_items.len()
        );

        Ok(IntelligenceResult {
            buffer_id: buffer.turn_order,
            analysis_type: AnalysisType::Summary,
            processing_time_ms,
            model_used: self.model.clone(),
            raw_text,
            timestamp: chrono::Utc::now(),
            sentiment: None,
            financial: None,
            competitive: None,
            summary: Some(summary_analysis),
            risk: None,
        })
    }

    fn analysis_type(&self) -> AnalysisType {
        AnalysisType::Summary
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
        let prompt = SummaryAgent::build_summary_prompt("We decided to expand operations");
        assert!(prompt.contains("We decided to expand operations"));
        assert!(prompt.contains("key points"));
        assert!(prompt.contains("action_items"));
    }

    #[test]
    fn test_parse_summary_response() {
        let response = r#"{
            "key_points": ["Revenue growth", "Market expansion"],
            "action_items": ["Hire staff", "Launch campaign"],
            "decisions_made": ["Approved budget"],
            "business_impact": "Positive growth trajectory",
            "follow_up_required": ["Board approval", "Legal review"]
        }"#;

        let result = SummaryAgent::parse_summary_response(response).unwrap();
        assert_eq!(result.key_points.len(), 2);
        assert_eq!(result.action_items.len(), 2);
        assert_eq!(result.decisions_made.len(), 1);
        assert_eq!(result.business_impact, Some("Positive growth trajectory".to_string()));
        assert_eq!(result.follow_up_required.len(), 2);
    }

    #[test]
    fn test_parse_summary_with_null_impact() {
        let response = r#"{
            "key_points": [],
            "action_items": [],
            "decisions_made": [],
            "business_impact": null,
            "follow_up_required": []
        }"#;

        let result = SummaryAgent::parse_summary_response(response).unwrap();
        assert!(result.business_impact.is_none());
        assert!(result.key_points.is_empty());
    }

    #[test]
    fn test_parse_with_markdown() {
        let response = r#"```json
{
  "key_points": ["Strong quarter"],
  "action_items": ["Continue growth"],
  "decisions_made": ["Increase investment"],
  "business_impact": "Positive outlook",
  "follow_up_required": ["Quarterly review"]
}
```"#;

        let result = SummaryAgent::parse_summary_response(response).unwrap();
        assert_eq!(result.key_points[0], "Strong quarter");
        assert_eq!(result.business_impact, Some("Positive outlook".to_string()));
    }
}