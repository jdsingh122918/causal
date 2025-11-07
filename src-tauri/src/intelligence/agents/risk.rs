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

    /// Build the risk analysis prompt with promise detection and delivery risk focus
    fn build_risk_prompt(text: &str) -> String {
        format!(
            r#"You are an expert risk analyst and business auditor specializing in promise detection and delivery risk assessment. Your role is to act as a critical evaluator who identifies commitments, analyzes delivery risks, and provides constructive risk insights.

MISSION: Identify all promises, commitments, and guidance given, then conduct thorough delivery risk assessment.

CRITICAL INSTRUCTIONS - MUST FOLLOW EXACTLY:
1. Return ONLY valid JSON - no explanations, no preamble, no markdown, no text before or after
2. Start your response immediately with {{ and end with }}
3. Do NOT wrap in ```json or ``` or any other formatting
4. Use the EXACT format specified below
5. Be thorough but constructive in identifying risks
6. Focus on actionable risk insights

PROMISE DETECTION:
- Identify explicit promises (direct commitments, guarantees)
- Identify implicit promises (guidance, expectations set, plans stated)
- Categorize by type: delivery, timeline, financial, operational, quality
- Assess specificity: specific (clear metrics/dates), vague (unclear), conditional (depends on factors)
- Extract timelines and stakeholders when mentioned

DELIVERY RISK ASSESSMENT:
- Evaluate risks that could prevent promise fulfillment
- Use risk taxonomy: technical, operational, financial, market, regulatory, resource
- Assess severity: low, medium, high, critical
- Assess likelihood: unlikely, possible, likely, very_likely
- Identify specific risk factors and potential impacts
- Note existing mitigation strategies mentioned

RISK CATEGORIES:
- Operational: Day-to-day execution risks, process issues, capacity constraints
- Financial: Budget overruns, funding gaps, cost pressures, revenue risks
- Market: Competition, demand changes, market conditions, customer risks
- Regulatory: Compliance issues, legal risks, policy changes
- Technical: Technology failures, integration issues, scalability problems
- Resource: Skills gaps, hiring challenges, supplier dependencies

Text to analyze:
{text}

Required JSON format:
{{
  "overall_risk_level": "medium",
  "risk_summary": "Brief overview of key risk concerns (2-3 sentences max)",
  "promises_identified": [
    {{
      "promise_text": "Launch product by Q2 2024",
      "promise_type": "timeline",
      "specificity": "specific",
      "timeline": "Q2 2024",
      "stakeholder": "CEO"
    }}
  ],
  "promise_clarity_score": 0.7,
  "delivery_risks": [
    {{
      "risk_area": "Q2 product launch",
      "risk_category": "operational",
      "severity": "high",
      "likelihood": "likely",
      "risk_factors": ["Development delays", "Resource constraints", "Integration complexity"],
      "potential_impact": "Launch delay could impact revenue targets and market positioning",
      "mitigation_notes": "Agile development approach mentioned"
    }}
  ],
  "critical_risks": ["Development timeline compression", "Unproven technology stack"],
  "operational_risks": ["Scaling team", "Process maturity"],
  "financial_risks": ["R&D budget pressure", "Cash burn rate"],
  "market_risks": ["Competitive launches", "Market timing"],
  "regulatory_risks": ["Data privacy compliance", "Industry regulations"],
  "existing_mitigations": ["Agile methodology", "Regular stakeholder reviews"],
  "recommended_actions": ["Establish contingency timeline", "Validate technical approach early"]
}}

VALIDATION RULES:
- overall_risk_level: Must be "low", "medium", "high", or "critical"
- risk_summary: Brief overview (2-3 sentences maximum)
- promises_identified: Array of promise objects (can be empty if none found)
- promise_type: Must be "delivery", "timeline", "financial", "operational", or "quality"
- specificity: Must be "specific", "vague", or "conditional"
- promise_clarity_score: Float between 0.0 and 1.0
- delivery_risks: Array of risk objects with detailed assessment (can be empty)
- severity: Must be "low", "medium", "high", or "critical"
- likelihood: Must be "unlikely", "possible", "likely", or "very_likely"
- risk_category: Must be "technical", "operational", "financial", "market", "regulatory", or "resource"
- All text arrays can be empty if no relevant items found

ANALYSIS APPROACH:
1. Read through content carefully to identify commitments and promises
2. For each promise, assess what could prevent its fulfillment
3. Categorize risks systematically across all dimensions
4. Provide specific, actionable risk factors
5. Note existing mitigations and suggest additional actions
6. Be constructive but thorough - identify real risks without being alarmist

REMEMBER: Return ONLY the JSON object below with no additional text, explanations, or formatting:

{{
  "overall_risk_level": "...",
  "risk_summary": "...",
  // ... rest of structure
}}"#,
            text = text
        )
    }

    /// Parse risk analysis response from API with enhanced structure
    fn parse_risk_response(response: &str) -> Result<RiskAnalysis, String> {
        use crate::intelligence::types::{PromiseCommitment, DeliveryRisk};

        // Log the raw response for debugging (truncated to avoid log spam)
        let response_preview = if response.len() > 200 {
            format!("{}...", &response[..200])
        } else {
            response.to_string()
        };
        tracing::debug!("Risk agent raw response preview: {}", response_preview);

        // Check if response is empty
        if response.trim().is_empty() {
            return Err("Empty response from Claude API".to_string());
        }

        // Clean the response - remove any markdown formatting and extra content
        let mut cleaned = response.trim();

        // Remove markdown code blocks
        if let Some(start) = cleaned.find("```json") {
            cleaned = &cleaned[start + 7..];
        }
        if let Some(start) = cleaned.find("```") {
            cleaned = &cleaned[start + 3..];
        }
        if let Some(end) = cleaned.rfind("```") {
            cleaned = &cleaned[..end];
        }

        // Find the first '{' and last '}' to extract just the JSON
        if let (Some(start), Some(end)) = (cleaned.find('{'), cleaned.rfind('}')) {
            cleaned = &cleaned[start..=end];
        }

        cleaned = cleaned.trim();

        // Log the cleaned response for debugging
        tracing::debug!("Risk agent cleaned response: {}", cleaned);

        // Validate that we have some JSON-like content
        if !cleaned.starts_with('{') || !cleaned.ends_with('}') {
            return Err(format!("Response does not appear to be valid JSON. Content: {}", cleaned));
        }

        // Parse JSON
        let parsed: serde_json::Value = serde_json::from_str(cleaned)
            .map_err(|e| {
                tracing::error!("Risk JSON parse error: {}. Content: {}", e, cleaned);
                format!("Failed to parse risk JSON: {}. Response: {}", e, cleaned)
            })?;

        // Extract overall risk level
        let overall_risk_level = parsed
            .get("overall_risk_level")
            .and_then(|v| v.as_str())
            .ok_or("Missing overall_risk_level field")?
            .to_string();

        // Validate risk level
        if !["low", "medium", "high", "critical"].contains(&overall_risk_level.as_str()) {
            return Err(format!("Invalid overall_risk_level value: {}", overall_risk_level));
        }

        // Extract risk summary
        let risk_summary = parsed
            .get("risk_summary")
            .and_then(|v| v.as_str())
            .unwrap_or("No summary provided")
            .to_string();

        // Parse promises identified
        let promises_identified = parsed
            .get("promises_identified")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|p| {
                        let promise_text = p.get("promise_text")?.as_str()?.to_string();
                        let promise_type = p.get("promise_type")?.as_str()?.to_string();
                        let specificity = p.get("specificity")?.as_str()?.to_string();
                        let timeline = p.get("timeline").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let stakeholder = p.get("stakeholder").and_then(|v| v.as_str()).map(|s| s.to_string());

                        Some(PromiseCommitment {
                            promise_text,
                            promise_type,
                            specificity,
                            timeline,
                            stakeholder,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        // Extract promise clarity score
        let promise_clarity_score = parsed
            .get("promise_clarity_score")
            .and_then(|v| v.as_f64())
            .map(|f| f as f32)
            .unwrap_or(0.0);

        // Parse delivery risks
        let delivery_risks = parsed
            .get("delivery_risks")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|r| {
                        let risk_area = r.get("risk_area")?.as_str()?.to_string();
                        let risk_category = r.get("risk_category")?.as_str()?.to_string();
                        let severity = r.get("severity")?.as_str()?.to_string();
                        let likelihood = r.get("likelihood")?.as_str()?.to_string();
                        let risk_factors = r.get("risk_factors")
                            .and_then(|v| v.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|v| v.as_str())
                                    .map(|s| s.to_string())
                                    .collect()
                            })
                            .unwrap_or_default();
                        let potential_impact = r.get("potential_impact")?.as_str()?.to_string();
                        let mitigation_notes = r.get("mitigation_notes")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());

                        Some(DeliveryRisk {
                            risk_area,
                            risk_category,
                            severity,
                            likelihood,
                            risk_factors,
                            potential_impact,
                            mitigation_notes,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        // Extract critical risks
        let critical_risks = Self::extract_string_array(&parsed, "critical_risks");

        // Extract risk category arrays
        let operational_risks = Self::extract_string_array(&parsed, "operational_risks");
        let financial_risks = Self::extract_string_array(&parsed, "financial_risks");
        let market_risks = Self::extract_string_array(&parsed, "market_risks");
        let regulatory_risks = Self::extract_string_array(&parsed, "regulatory_risks");

        // Extract mitigation arrays
        let existing_mitigations = Self::extract_string_array(&parsed, "existing_mitigations");
        let recommended_actions = Self::extract_string_array(&parsed, "recommended_actions");

        Ok(RiskAnalysis {
            overall_risk_level,
            risk_summary,
            promises_identified,
            promise_clarity_score,
            delivery_risks,
            critical_risks,
            operational_risks,
            financial_risks,
            market_risks,
            regulatory_risks,
            existing_mitigations,
            recommended_actions,
        })
    }

    /// Helper to extract string arrays from JSON
    fn extract_string_array(parsed: &serde_json::Value, field: &str) -> Vec<String> {
        parsed
            .get(field)
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default()
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

        // Parse the risk analysis with fallback on failure
        let risk_analysis = match Self::parse_risk_response(&response_text) {
            Ok(analysis) => analysis,
            Err(parse_error) => {
                tracing::warn!("Risk analysis parsing failed, using fallback: {}", parse_error);

                // Create a fallback analysis to prevent complete failure
                RiskAnalysis {
                    overall_risk_level: "medium".to_string(),
                    risk_summary: format!("Analysis temporarily unavailable due to parsing error: {}", parse_error),
                    promises_identified: vec![],
                    promise_clarity_score: 0.0,
                    delivery_risks: vec![],
                    critical_risks: vec!["Analysis parsing failed - manual review recommended".to_string()],
                    operational_risks: vec![],
                    financial_risks: vec![],
                    market_risks: vec![],
                    regulatory_risks: vec![],
                    existing_mitigations: vec![],
                    recommended_actions: vec!["Retry analysis or review manually".to_string()],
                }
            }
        };

        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        tracing::debug!(
            "⚠️ Risk analysis complete for buffer {} ({}ms): {} level, {} promises, {} delivery risks, {} critical risks",
            buffer.turn_order,
            processing_time_ms,
            risk_analysis.overall_risk_level,
            risk_analysis.promises_identified.len(),
            risk_analysis.delivery_risks.len(),
            risk_analysis.critical_risks.len()
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
        let prompt = RiskAgent::build_risk_prompt("We plan to launch our new product by Q2 2024");
        assert!(prompt.contains("We plan to launch our new product by Q2 2024"));
        assert!(prompt.contains("promise detection"));
        assert!(prompt.contains("delivery risk"));
        assert!(prompt.contains("promises_identified"));
        assert!(prompt.contains("delivery_risks"));
    }

    #[test]
    fn test_parse_enhanced_risk_response() {
        let response = r#"{
            "overall_risk_level": "medium",
            "risk_summary": "Timeline commitments face operational execution challenges",
            "promises_identified": [
                {
                    "promise_text": "Launch by Q2",
                    "promise_type": "timeline",
                    "specificity": "specific",
                    "timeline": "Q2 2024",
                    "stakeholder": "CEO"
                }
            ],
            "promise_clarity_score": 0.8,
            "delivery_risks": [
                {
                    "risk_area": "Product launch",
                    "risk_category": "operational",
                    "severity": "high",
                    "likelihood": "likely",
                    "risk_factors": ["Resource constraints", "Technical debt"],
                    "potential_impact": "Launch delay affecting market position",
                    "mitigation_notes": "Agile methodology in place"
                }
            ],
            "critical_risks": ["Timeline compression"],
            "operational_risks": ["Team scaling"],
            "financial_risks": ["Budget overrun"],
            "market_risks": ["Competition"],
            "regulatory_risks": ["Compliance"],
            "existing_mitigations": ["Agile process"],
            "recommended_actions": ["Add contingency buffer"]
        }"#;

        let result = RiskAgent::parse_risk_response(response).unwrap();
        assert_eq!(result.overall_risk_level, "medium");
        assert_eq!(result.promises_identified.len(), 1);
        assert_eq!(result.promises_identified[0].promise_text, "Launch by Q2");
        assert_eq!(result.promises_identified[0].promise_type, "timeline");
        assert_eq!(result.promise_clarity_score, 0.8);
        assert_eq!(result.delivery_risks.len(), 1);
        assert_eq!(result.delivery_risks[0].severity, "high");
        assert_eq!(result.critical_risks.len(), 1);
        assert_eq!(result.operational_risks.len(), 1);
    }

    #[test]
    fn test_invalid_risk_level() {
        let response = r#"{
            "overall_risk_level": "invalid",
            "risk_summary": "Test",
            "promises_identified": [],
            "promise_clarity_score": 0.5,
            "delivery_risks": [],
            "critical_risks": [],
            "operational_risks": [],
            "financial_risks": [],
            "market_risks": [],
            "regulatory_risks": [],
            "existing_mitigations": [],
            "recommended_actions": []
        }"#;

        assert!(RiskAgent::parse_risk_response(response).is_err());
    }

    #[test]
    fn test_parse_with_markdown() {
        let response = r#"```json
{
  "overall_risk_level": "high",
  "risk_summary": "Critical delivery risks identified",
  "promises_identified": [],
  "promise_clarity_score": 0.0,
  "delivery_risks": [],
  "critical_risks": ["Major technical risk"],
  "operational_risks": [],
  "financial_risks": [],
  "market_risks": [],
  "regulatory_risks": [],
  "existing_mitigations": [],
  "recommended_actions": []
}
```"#;

        let result = RiskAgent::parse_risk_response(response).unwrap();
        assert_eq!(result.overall_risk_level, "high");
        assert_eq!(result.critical_risks[0], "Major technical risk");
    }

    #[test]
    fn test_empty_arrays() {
        let response = r#"{
            "overall_risk_level": "low",
            "risk_summary": "Minimal risks identified",
            "promises_identified": [],
            "promise_clarity_score": 0.0,
            "delivery_risks": [],
            "critical_risks": [],
            "operational_risks": [],
            "financial_risks": [],
            "market_risks": [],
            "regulatory_risks": [],
            "existing_mitigations": [],
            "recommended_actions": []
        }"#;

        let result = RiskAgent::parse_risk_response(response).unwrap();
        assert_eq!(result.overall_risk_level, "low");
        assert!(result.promises_identified.is_empty());
        assert!(result.delivery_risks.is_empty());
        assert!(result.critical_risks.is_empty());
    }

    #[test]
    fn test_critical_risk_level() {
        let response = r#"{
            "overall_risk_level": "critical",
            "risk_summary": "Severe delivery risks threaten project viability",
            "promises_identified": [],
            "promise_clarity_score": 0.0,
            "delivery_risks": [],
            "critical_risks": ["Project viability at risk"],
            "operational_risks": [],
            "financial_risks": [],
            "market_risks": [],
            "regulatory_risks": [],
            "existing_mitigations": [],
            "recommended_actions": []
        }"#;

        let result = RiskAgent::parse_risk_response(response).unwrap();
        assert_eq!(result.overall_risk_level, "critical");
    }
}