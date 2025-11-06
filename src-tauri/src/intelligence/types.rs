use crate::transcription::buffer::TranscriptionBuffer;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Type of business intelligence analysis
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AnalysisType {
    Sentiment,
    Financial,
    Competitive,
    Summary,
    Risk,
}

impl AnalysisType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AnalysisType::Sentiment => "sentiment",
            AnalysisType::Financial => "financial",
            AnalysisType::Competitive => "competitive",
            AnalysisType::Summary => "summary",
            AnalysisType::Risk => "risk",
        }
    }
}

/// Sentiment analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentAnalysis {
    pub overall_sentiment: String, // "positive", "negative", "neutral"
    pub confidence: f32,           // 0.0 to 1.0
    pub emotional_tone: Vec<String>, // ["confident", "uncertain", "optimistic"]
    pub key_phrases: Vec<String>,  // Important phrases that drove sentiment
}

/// Financial metrics extracted from transcript
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinancialAnalysis {
    pub metrics: HashMap<String, f64>, // "revenue" -> 1000000.0
    pub currencies: Vec<String>,       // ["USD", "EUR"]
    pub percentages: Vec<f32>,        // [15.5, 20.0] for growth rates
    pub financial_terms: Vec<String>, // ["EBITDA", "revenue", "profit margin"]
    pub outlook: Option<String>,      // "bullish", "bearish", "neutral"
}

/// Competitive intelligence analysis with financial analyst insights
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitiveAnalysis {
    pub competitors_mentioned: Vec<String>, // ["Apple", "Google", "Microsoft"]
    pub competitive_positioning: Option<String>, // How company positions vs competitors
    pub market_share_mentions: Vec<String>, // References to market share
    pub competitive_advantages: Vec<String>, // Claimed advantages over competitors
    pub threats_identified: Vec<String>,   // Competitive threats mentioned

    // Enhanced financial analyst insights
    pub industry_impact: Option<String>,   // How developments affect the broader industry
    pub company_effects: Vec<String>,      // Specific implications for mentioned companies
    pub strategic_questions: Vec<String>,  // Insightful follow-up questions for analysts
    pub competitive_moats: Vec<String>,    // Identified competitive advantages/barriers
    pub market_dynamics: Option<String>,   // Overall competitive landscape assessment
}

/// Summary and key insights
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryAnalysis {
    pub key_points: Vec<String>,      // Main takeaways
    pub action_items: Vec<String>,    // Actionable items mentioned
    pub decisions_made: Vec<String>,  // Key decisions discussed
    pub business_impact: Option<String>, // Assessment of business impact
    pub follow_up_required: Vec<String>, // Items requiring follow-up
}

/// Promise or commitment identified in content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromiseCommitment {
    pub promise_text: String,         // The actual promise/commitment made
    pub promise_type: String,         // "delivery", "timeline", "financial", "operational", "quality"
    pub specificity: String,          // "specific", "vague", "conditional"
    pub timeline: Option<String>,     // Expected timeline if mentioned
    pub stakeholder: Option<String>,  // Who made the promise (if identifiable)
}

/// Delivery risk assessment for a specific promise or area
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRisk {
    pub risk_area: String,            // Area of risk (e.g., specific promise or operational area)
    pub risk_category: String,        // "technical", "operational", "financial", "market", "regulatory", "resource"
    pub severity: String,             // "low", "medium", "high", "critical"
    pub likelihood: String,           // "unlikely", "possible", "likely", "very_likely"
    pub risk_factors: Vec<String>,    // Specific factors contributing to risk
    pub potential_impact: String,     // Description of potential impact if risk materializes
    pub mitigation_notes: Option<String>, // Existing mitigation strategies mentioned
}

/// Risk analysis with focus on promises and delivery risks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAnalysis {
    // Overall risk assessment
    pub overall_risk_level: String,   // "low", "medium", "high", "critical"
    pub risk_summary: String,         // Brief summary of key risk concerns

    // Promise detection and analysis
    pub promises_identified: Vec<PromiseCommitment>, // Explicit and implicit promises detected
    pub promise_clarity_score: f32,   // 0.0-1.0: How clear and specific the promises are

    // Delivery risk assessment
    pub delivery_risks: Vec<DeliveryRisk>, // Specific delivery risks identified
    pub critical_risks: Vec<String>,  // Top critical risks requiring immediate attention

    // Traditional risk categories (maintained for compatibility)
    pub operational_risks: Vec<String>, // Day-to-day operational risks
    pub financial_risks: Vec<String>,   // Financial and resource risks
    pub market_risks: Vec<String>,      // Market and competitive risks
    pub regulatory_risks: Vec<String>,  // Compliance and regulatory risks

    // Mitigation and recommendations
    pub existing_mitigations: Vec<String>, // Mitigation strategies mentioned
    pub recommended_actions: Vec<String>,  // Additional recommended risk mitigation actions
}

/// Comprehensive intelligence result from a single agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligenceResult {
    pub buffer_id: u32,
    pub analysis_type: AnalysisType,
    pub processing_time_ms: u64,
    pub model_used: String,
    pub raw_text: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,

    // Analysis results (only one will be populated based on analysis_type)
    pub sentiment: Option<SentimentAnalysis>,
    pub financial: Option<FinancialAnalysis>,
    pub competitive: Option<CompetitiveAnalysis>,
    pub summary: Option<SummaryAnalysis>,
    pub risk: Option<RiskAnalysis>,
}

/// Combined intelligence from all agents for a single buffer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinedIntelligence {
    pub buffer_id: u32,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub results: HashMap<AnalysisType, IntelligenceResult>,
    pub processing_complete: bool,
}

/// Configuration for intelligence agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligenceConfig {
    pub enabled_analyses: Vec<AnalysisType>,
    pub api_key: String,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub concurrent_agents: usize,
}

impl Default for IntelligenceConfig {
    fn default() -> Self {
        Self {
            enabled_analyses: vec![
                AnalysisType::Sentiment,
                AnalysisType::Financial,
                AnalysisType::Competitive,
                AnalysisType::Summary,
            ],
            api_key: String::new(),
            model: "claude-haiku-4-5-20251001".to_string(),
            max_tokens: 4096,
            temperature: 0.3,
            concurrent_agents: 4,
        }
    }
}

/// Trait for all intelligence agents
#[async_trait::async_trait]
pub trait IntelligenceAgent: Send + Sync {
    /// Analyze a transcription buffer and return intelligence result
    async fn analyze(&self, buffer: &TranscriptionBuffer) -> Result<IntelligenceResult, String>;

    /// Get the analysis type this agent handles
    fn analysis_type(&self) -> AnalysisType;

    /// Get the model being used
    fn model(&self) -> &str;
}

/// Event emitted when intelligence analysis is complete
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligenceEvent {
    pub buffer_id: u32,
    pub analysis_type: AnalysisType,
    pub result: IntelligenceResult,
    pub all_analyses_complete: bool,
}