use crate::intelligence::types::*;
use crate::transcription::buffer::TranscriptionBuffer;
use anthropic_sdk::Client;
use async_trait::async_trait;
use serde_json::json;
use tokio::sync::mpsc;

/// AI agent specialized in risk assessment and threat identification
pub struct RiskAgent {
    api_key: String,
    model: String,
}

impl RiskAgent {
    /// Create a new risk analysis agent
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            model: "claude-haiku-4-5-20251001".to_string(),
        }
    }

    /// Build the risk analysis prompt
    fn build_risk_prompt(text: &str) -> String {
        format!(
            r#"You are a business risk assessment expert specializing in identifying threats, challenges, and risk factors from earnings calls and business communications. Analyze the following transcript segment for business risks, threats, and mitigation strategies.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no explanations, no preamble, no markdown
2. Use the EXACT format specified below
3. Focus on business risks, not market volatility
4. Risk level must be: "low", "medium", or "high"

Analyze for:
- Business risks and threats identified
- Overall risk assessment level
- Mitigation strategies mentioned
- Regulatory or compliance concerns

Text to analyze:
{text}

Required JSON format:
{{
  "risks_identified": ["Supply chain disruption", "Increased competition", "Regulatory changes"],
  "risk_level": "medium",
  "mitigation_strategies": ["Diversify suppliers", "Invest in R&D", "Compliance program"],
  "regulatory_concerns": ["New data privacy laws", "Environmental regulations"]
}}

Rules:
- risks_identified: List specific business risks, threats, or challenges mentioned
- risk_level: Overall assessment ("low", "medium", "high")
- mitigation_strategies: Risk mitigation approaches or strategies mentioned
- regulatory_concerns: Regulatory, compliance, or legal risks identified

JSON response:"#,
            text = text
        )
    }

    /// Parse risk analysis response from API
    fn parse_risk_response(response: &str) -> Result<RiskAnalysis, String> {
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
            .map_err(|e| format!("Failed to parse risk JSON: {}", e))?;

        // Extract risks identified
        let risks_identified = parsed
            .get("risks_identified")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract risk level
        let risk_level = parsed
            .get("risk_level")
            .and_then(|v| v.as_str())
            .ok_or("Missing risk_level field")?
            .to_string();

        // Validate risk level
        if !["low", "medium", "high"].contains(&risk_level.as_str()) {
            return Err(format!("Invalid risk_level value: {}", risk_level));
        }

        // Extract mitigation strategies
        let mitigation_strategies = parsed
            .get("mitigation_strategies")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract regulatory concerns
        let regulatory_concerns = parsed
            .get("regulatory_concerns")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        Ok(RiskAnalysis {
            risks_identified,
            risk_level,
            mitigation_strategies,
            regulatory_concerns,
        })
    }
}

#[async_trait]
impl IntelligenceAgent for RiskAgent {
    async fn analyze(&self, buffer: &TranscriptionBuffer) -> Result<IntelligenceResult, String> {
        let start_time = std::time::Instant::now();
        let raw_text = buffer.combined_text();

        // Skip empty buffers
        if raw_text.trim().is_empty() {
            return Err("Empty buffer for risk analysis".to_string());
        }

        tracing::debug!(
            "⚠️ Analyzing business risks for buffer {} ({} chars)",
            buffer.turn_order,
            raw_text.len()
        );

        // Build the prompt
        let prompt = Self::build_risk_prompt(&raw_text);

        // Create the API request
        let request = Client::new()
            .auth(&self.api_key)
            .model(&self.model)
            .messages(&json!([
                {"role": "user", "content": prompt}
            ]))
            .max_tokens(2048)
            .temperature(0.2) // Low temperature for consistent risk assessment
            .build()
            .map_err(|e| format!("Failed to build risk request: {}", e))?;

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

        // Parse the risk analysis
        let risk_analysis = Self::parse_risk_response(&response_text)?;

        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        tracing::debug!(
            "⚠️ Risk analysis complete for buffer {} ({}ms): {} level, {} risks",
            buffer.turn_order,
            processing_time_ms,
            risk_analysis.risk_level,
            risk_analysis.risks_identified.len()
        );

        Ok(IntelligenceResult {
            buffer_id: buffer.turn_order,
            analysis_type: AnalysisType::Risk,
            processing_time_ms,
            model_used: self.model.clone(),
            raw_text,
            timestamp: chrono::Utc::now(),
            sentiment: None,
            financial: None,
            competitive: None,
            summary: None,
            risk: Some(risk_analysis),
        })
    }

    fn analysis_type(&self) -> AnalysisType {
        AnalysisType::Risk
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
        let prompt = RiskAgent::build_risk_prompt("Supply chain issues may impact delivery");
        assert!(prompt.contains("Supply chain issues may impact delivery"));
        assert!(prompt.contains("risk assessment"));
        assert!(prompt.contains("risks_identified"));
    }

    #[test]
    fn test_parse_risk_response() {
        let response = r#"{
            "risks_identified": ["Supply chain disruption", "Competition"],
            "risk_level": "medium",
            "mitigation_strategies": ["Diversify suppliers", "Invest in R&D"],
            "regulatory_concerns": ["New regulations", "Compliance issues"]
        }"#;

        let result = RiskAgent::parse_risk_response(response).unwrap();
        assert_eq!(result.risks_identified.len(), 2);
        assert_eq!(result.risk_level, "medium");
        assert_eq!(result.mitigation_strategies.len(), 2);
        assert_eq!(result.regulatory_concerns.len(), 2);
    }

    #[test]
    fn test_invalid_risk_level() {
        let response = r#"{
            "risks_identified": [],
            "risk_level": "invalid",
            "mitigation_strategies": [],
            "regulatory_concerns": []
        }"#;

        assert!(RiskAgent::parse_risk_response(response).is_err());
    }

    #[test]
    fn test_parse_with_markdown() {
        let response = r#"```json
{
  "risks_identified": ["Market volatility"],
  "risk_level": "high",
  "mitigation_strategies": ["Hedge positions"],
  "regulatory_concerns": ["New compliance rules"]
}
```"#;

        let result = RiskAgent::parse_risk_response(response).unwrap();
        assert_eq!(result.risk_level, "high");
        assert_eq!(result.risks_identified[0], "Market volatility");
    }

    #[test]
    fn test_empty_arrays() {
        let response = r#"{
            "risks_identified": [],
            "risk_level": "low",
            "mitigation_strategies": [],
            "regulatory_concerns": []
        }"#;

        let result = RiskAgent::parse_risk_response(response).unwrap();
        assert_eq!(result.risk_level, "low");
        assert!(result.risks_identified.is_empty());
        assert!(result.mitigation_strategies.is_empty());
        assert!(result.regulatory_concerns.is_empty());
    }
}