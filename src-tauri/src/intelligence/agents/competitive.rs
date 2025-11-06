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

    /// Build the competitive analysis prompt with financial analyst expertise
    fn build_competitive_prompt(text: &str) -> String {
        format!(
            r#"You are a senior financial industry analyst with 15+ years of experience analyzing competitive dynamics in earnings calls, investor presentations, and business communications. Your expertise spans:

- Industry sector analysis and competitive positioning
- Company-specific competitive advantages and moats
- Market dynamics and structural changes
- Strategic implications for competitors and the broader industry
- Risk-reward assessment in competitive contexts

Analyze the following transcript segment as a professional financial analyst would, extracting competitive intelligence and generating actionable insights.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no explanations, no preamble, no markdown
2. Use the EXACT format specified below
3. Think like a buy-side or sell-side equity analyst
4. Generate insightful follow-up questions that a senior analyst would ask
5. Assess broader industry implications, not just company-specific details

ANALYSIS FRAMEWORK:

**Competitive Intelligence (Basic)**
- Competitors mentioned by name (companies, products, services)
- Competitive positioning statements
- Market share references and rankings
- Claimed competitive advantages
- Identified competitive threats

**Financial Analyst Insights (Advanced)**
- Industry Impact: How do these developments affect the broader industry/sector?
- Company Effects: What are the specific implications for each mentioned competitor?
- Strategic Questions: What follow-up questions would you ask management or in your research?
- Competitive Moats: What sustainable competitive advantages or barriers to entry are evident?
- Market Dynamics: What is the overall competitive landscape and how is it evolving?

Text to analyze:
{text}

Required JSON format:
{{
  "competitors_mentioned": ["Apple", "Google", "Microsoft"],
  "competitive_positioning": "We differentiate through superior customer service and innovation",
  "market_share_mentions": ["leading market position", "gained 3% market share"],
  "competitive_advantages": ["proprietary technology", "exclusive partnerships", "cost leadership"],
  "threats_identified": ["increased competition in mobile", "new entrant in cloud services"],
  "industry_impact": "Increasing commoditization in the smartphone market may compress margins across all players",
  "company_effects": [
    "Apple: Potential margin pressure from competition, but strong ecosystem lock-in provides defense",
    "Google: Search dominance creates cross-selling opportunities in cloud",
    "Microsoft: Enterprise focus insulates from consumer market volatility"
  ],
  "strategic_questions": [
    "What specific metrics define 'market leadership' - units, revenue, or profit share?",
    "How sustainable is the claimed cost advantage given rising input costs?",
    "What is the company's strategy if the new cloud competitor gains enterprise traction?"
  ],
  "competitive_moats": [
    "Network effects from 500M+ user platform",
    "Proprietary AI algorithms with 10-year development lead",
    "High switching costs due to enterprise integration depth"
  ],
  "market_dynamics": "Market transitioning from hardware-centric to services-driven model, favoring companies with strong recurring revenue and ecosystem lock-in"
}}

Rules:
- competitors_mentioned: List company/brand names mentioned as competitors or relevant players
- competitive_positioning: Single string summarizing how company positions vs competitors (or null if not discussed)
- market_share_mentions: List specific phrases about market share, position, or ranking
- competitive_advantages: List claimed advantages or differentiators
- threats_identified: List competitive threats or challenges mentioned

**Enhanced Financial Analyst Fields:**
- industry_impact: 1-2 sentence assessment of how these developments affect the broader industry/sector (or null)
- company_effects: List of specific implications for each mentioned competitor (company name + implication)
- strategic_questions: 2-5 insightful follow-up questions a financial analyst would ask (focus on clarifying competitive dynamics, sustainability, quantification)
- competitive_moats: Identified sustainable competitive advantages, barriers to entry, or economic moats
- market_dynamics: 1-2 sentence assessment of overall competitive landscape and evolution (or null)

QUALITY STANDARDS:
- Strategic questions should be specific, not generic
- Company effects should name the company and state the implication
- Industry impact should consider structural changes, not just cyclical trends
- Competitive moats should be sustainable advantages, not temporary ones

JSON response:"#,
            text = text
        )
    }

    /// Parse competitive analysis response from API with enhanced financial analyst fields
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

        // Extract enhanced financial analyst fields

        // Extract industry impact
        let industry_impact = parsed
            .get("industry_impact")
            .and_then(|v| {
                if v.is_null() {
                    None
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            });

        // Extract company effects
        let company_effects = parsed
            .get("company_effects")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract strategic questions
        let strategic_questions = parsed
            .get("strategic_questions")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract competitive moats
        let competitive_moats = parsed
            .get("competitive_moats")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract market dynamics
        let market_dynamics = parsed
            .get("market_dynamics")
            .and_then(|v| {
                if v.is_null() {
                    None
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            });

        Ok(CompetitiveAnalysis {
            competitors_mentioned,
            competitive_positioning,
            market_share_mentions,
            competitive_advantages,
            threats_identified,
            industry_impact,
            company_effects,
            strategic_questions,
            competitive_moats,
            market_dynamics,
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
            "🏆 Competitive analysis complete for buffer {} ({}ms): {} competitors, {} advantages, {} questions, {} moats",
            buffer.turn_order,
            processing_time_ms,
            competitive_analysis.competitors_mentioned.len(),
            competitive_analysis.competitive_advantages.len(),
            competitive_analysis.strategic_questions.len(),
            competitive_analysis.competitive_moats.len()
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
            "threats_identified": ["new entrants", "price competition"],
            "industry_impact": "Market consolidation expected",
            "company_effects": ["Apple: Margin pressure", "Google: Market share gain"],
            "strategic_questions": ["How sustainable is growth?", "What are the barriers?"],
            "competitive_moats": ["Network effects", "Brand loyalty"],
            "market_dynamics": "Shifting to subscription model"
        }"#;

        let result = CompetitiveAgent::parse_competitive_response(response).unwrap();
        assert_eq!(result.competitors_mentioned.len(), 2);
        assert_eq!(result.competitive_positioning, Some("We lead through innovation".to_string()));
        assert_eq!(result.market_share_mentions.len(), 2);
        assert_eq!(result.competitive_advantages.len(), 2);
        assert_eq!(result.threats_identified.len(), 2);
        assert_eq!(result.industry_impact, Some("Market consolidation expected".to_string()));
        assert_eq!(result.company_effects.len(), 2);
        assert_eq!(result.strategic_questions.len(), 2);
        assert_eq!(result.competitive_moats.len(), 2);
        assert_eq!(result.market_dynamics, Some("Shifting to subscription model".to_string()));
    }

    #[test]
    fn test_parse_competitive_with_null_positioning() {
        let response = r#"{
            "competitors_mentioned": [],
            "competitive_positioning": null,
            "market_share_mentions": [],
            "competitive_advantages": [],
            "threats_identified": [],
            "industry_impact": null,
            "company_effects": [],
            "strategic_questions": [],
            "competitive_moats": [],
            "market_dynamics": null
        }"#;

        let result = CompetitiveAgent::parse_competitive_response(response).unwrap();
        assert!(result.competitive_positioning.is_none());
        assert!(result.competitors_mentioned.is_empty());
        assert!(result.industry_impact.is_none());
        assert!(result.market_dynamics.is_none());
    }

    #[test]
    fn test_parse_with_markdown() {
        let response = r#"```json
{
  "competitors_mentioned": ["Microsoft"],
  "competitive_positioning": "Superior customer service",
  "market_share_mentions": ["market position"],
  "competitive_advantages": ["innovation"],
  "threats_identified": ["competition"],
  "industry_impact": "Cloud migration accelerating",
  "company_effects": ["Microsoft: Enterprise dominance"],
  "strategic_questions": ["What is Azure growth rate?"],
  "competitive_moats": ["Enterprise relationships"],
  "market_dynamics": "Hybrid cloud adoption"
}
```"#;

        let result = CompetitiveAgent::parse_competitive_response(response).unwrap();
        assert_eq!(result.competitors_mentioned[0], "Microsoft");
        assert_eq!(result.competitive_positioning, Some("Superior customer service".to_string()));
        assert_eq!(result.industry_impact, Some("Cloud migration accelerating".to_string()));
    }

    #[test]
    fn test_empty_arrays() {
        let response = r#"{
            "competitors_mentioned": [],
            "competitive_positioning": "No specific positioning",
            "market_share_mentions": [],
            "competitive_advantages": [],
            "threats_identified": [],
            "industry_impact": null,
            "company_effects": [],
            "strategic_questions": [],
            "competitive_moats": [],
            "market_dynamics": null
        }"#;

        let result = CompetitiveAgent::parse_competitive_response(response).unwrap();
        assert!(result.competitors_mentioned.is_empty());
        assert!(result.market_share_mentions.is_empty());
        assert!(result.competitive_advantages.is_empty());
        assert!(result.threats_identified.is_empty());
        assert!(result.company_effects.is_empty());
        assert!(result.strategic_questions.is_empty());
        assert!(result.competitive_moats.is_empty());
    }
}