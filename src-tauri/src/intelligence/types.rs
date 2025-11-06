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

/// Competitive intelligence analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitiveAnalysis {
    pub competitors_mentioned: Vec<String>, // ["Apple", "Google", "Microsoft"]
    pub competitive_positioning: Option<String>, // How company positions vs competitors
    pub market_share_mentions: Vec<String>, // References to market share
    pub competitive_advantages: Vec<String>, // Claimed advantages over competitors
    pub threats_identified: Vec<String>,   // Competitive threats mentioned
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

/// Risk analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAnalysis {
    pub risks_identified: Vec<String>, // Identified business risks
    pub risk_level: String,           // "low", "medium", "high"
    pub mitigation_strategies: Vec<String>, // Mentioned mitigation approaches
    pub regulatory_concerns: Vec<String>, // Regulatory or compliance risks
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