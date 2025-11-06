use crate::intelligence::types::*;
use crate::transcription::buffer::TranscriptionBuffer;
use anthropic_sdk::Client;
use async_trait::async_trait;
use serde_json::json;
use std::collections::HashMap;
use tokio::sync::mpsc;

/// AI agent specialized in financial metrics and business performance analysis
pub struct FinancialAgent {
    api_key: String,
    model: String,
}

impl FinancialAgent {
    /// Create a new financial analysis agent
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            model: "claude-haiku-4-5-20251001".to_string(),
        }
    }

    /// Build the financial analysis prompt
    fn build_financial_prompt(text: &str) -> String {
        format!(
            r#"You are a financial analysis expert specializing in earnings calls and business communications. Extract and analyze financial metrics, numbers, and business performance indicators from the following transcript segment.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no explanations, no preamble, no markdown
2. Use the EXACT format specified below
3. Extract numerical values accurately (convert to numbers, not strings)
4. Identify currency symbols and percentage values
5. Focus on business-relevant financial metrics

Extract and analyze:
- Financial metrics (revenue, profit, EBITDA, margins, growth rates, etc.)
- Currencies mentioned (USD, EUR, GBP, etc.)
- Percentage values (growth rates, margins, market share, etc.)
- Financial terminology used
- Overall financial outlook sentiment

Text to analyze:
{text}

Required JSON format:
{{
  "metrics": {{
    "revenue": 1000000.0,
    "growth_rate": 15.5,
    "profit_margin": 12.3
  }},
  "currencies": ["USD", "EUR"],
  "percentages": [15.5, 12.3, 8.7],
  "financial_terms": ["revenue", "EBITDA", "margin", "growth"],
  "outlook": "bullish|bearish|neutral|null"
}}

Rules:
- metrics: Extract named financial values as numbers (no strings)
- currencies: List currency codes found (USD, EUR, etc.)
- percentages: List all percentage values found as numbers
- financial_terms: List financial/business terms mentioned
- outlook: Overall financial sentiment (bullish/bearish/neutral) or null if unclear

JSON response:"#,
            text = text
        )
    }

    /// Parse financial analysis response from API
    fn parse_financial_response(response: &str) -> Result<FinancialAnalysis, String> {
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
            .map_err(|e| format!("Failed to parse financial JSON: {}", e))?;

        // Extract metrics
        let metrics = parsed
            .get("metrics")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| {
                        v.as_f64().map(|num| (k.clone(), num))
                    })
                    .collect::<HashMap<String, f64>>()
            })
            .unwrap_or_default();

        // Extract currencies
        let currencies = parsed
            .get("currencies")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract percentages
        let percentages = parsed
            .get("percentages")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_f64())
                    .map(|f| f as f32)
                    .collect()
            })
            .unwrap_or_default();

        // Extract financial terms
        let financial_terms = parsed
            .get("financial_terms")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract outlook
        let outlook = parsed
            .get("outlook")
            .and_then(|v| {
                if v.is_null() {
                    None
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            });

        // Validate outlook if present
        if let Some(ref outlook_val) = outlook {
            if !["bullish", "bearish", "neutral"].contains(&outlook_val.as_str()) {
                return Err(format!("Invalid outlook value: {}", outlook_val));
            }
        }

        Ok(FinancialAnalysis {
            metrics,
            currencies,
            percentages,
            financial_terms,
            outlook,
        })
    }
}

#[async_trait]
impl IntelligenceAgent for FinancialAgent {
    async fn analyze(&self, buffer: &TranscriptionBuffer) -> Result<IntelligenceResult, String> {
        let start_time = std::time::Instant::now();
        let raw_text = buffer.combined_text();

        // Skip empty buffers
        if raw_text.trim().is_empty() {
            return Err("Empty buffer for financial analysis".to_string());
        }

        tracing::debug!(
            "💰 Analyzing financial metrics for buffer {} ({} chars)",
            buffer.turn_order,
            raw_text.len()
        );

        // Build the prompt
        let prompt = Self::build_financial_prompt(&raw_text);

        // Create the API request
        let request = Client::new()
            .auth(&self.api_key)
            .model(&self.model)
            .messages(&json!([
                {"role": "user", "content": prompt}
            ]))
            .max_tokens(2048)
            .temperature(0.1) // Low temperature for accurate number extraction
            .build()
            .map_err(|e| format!("Failed to build financial request: {}", e))?;

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

        // Parse the financial analysis
        let financial_analysis = Self::parse_financial_response(&response_text)?;

        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        tracing::debug!(
            "💰 Financial analysis complete for buffer {} ({}ms): {} metrics, {} terms",
            buffer.turn_order,
            processing_time_ms,
            financial_analysis.metrics.len(),
            financial_analysis.financial_terms.len()
        );

        Ok(IntelligenceResult {
            buffer_id: buffer.turn_order,
            analysis_type: AnalysisType::Financial,
            processing_time_ms,
            model_used: self.model.clone(),
            raw_text,
            timestamp: chrono::Utc::now(),
            sentiment: None,
            financial: Some(financial_analysis),
            competitive: None,
            summary: None,
            risk: None,
        })
    }

    fn analysis_type(&self) -> AnalysisType {
        AnalysisType::Financial
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
        let prompt = FinancialAgent::build_financial_prompt("Revenue grew 15%");
        assert!(prompt.contains("Revenue grew 15%"));
        assert!(prompt.contains("financial analysis"));
        assert!(prompt.contains("metrics"));
    }

    #[test]
    fn test_parse_financial_response() {
        let response = r#"{
            "metrics": {
                "revenue": 1000000.0,
                "growth_rate": 15.5
            },
            "currencies": ["USD", "EUR"],
            "percentages": [15.5, 12.3],
            "financial_terms": ["revenue", "growth"],
            "outlook": "bullish"
        }"#;

        let result = FinancialAgent::parse_financial_response(response).unwrap();
        assert_eq!(result.metrics.len(), 2);
        assert_eq!(result.currencies.len(), 2);
        assert_eq!(result.percentages.len(), 2);
        assert_eq!(result.outlook, Some("bullish".to_string()));
    }

    #[test]
    fn test_parse_financial_with_null_outlook() {
        let response = r#"{
            "metrics": {},
            "currencies": [],
            "percentages": [],
            "financial_terms": [],
            "outlook": null
        }"#;

        let result = FinancialAgent::parse_financial_response(response).unwrap();
        assert!(result.outlook.is_none());
    }

    #[test]
    fn test_invalid_outlook_value() {
        let response = r#"{
            "metrics": {},
            "currencies": [],
            "percentages": [],
            "financial_terms": [],
            "outlook": "invalid"
        }"#;

        assert!(FinancialAgent::parse_financial_response(response).is_err());
    }

    #[test]
    fn test_parse_with_markdown() {
        let response = r#"```json
{
  "metrics": {"revenue": 500000.0},
  "currencies": ["USD"],
  "percentages": [10.0],
  "financial_terms": ["revenue"],
  "outlook": "neutral"
}
```"#;

        let result = FinancialAgent::parse_financial_response(response).unwrap();
        assert_eq!(result.metrics.get("revenue"), Some(&500000.0));
        assert_eq!(result.outlook, Some("neutral".to_string()));
    }
}