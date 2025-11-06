/// Individual intelligence agents for specialized analysis
///
/// Each agent focuses on a specific type of business intelligence analysis:
/// - SentimentAgent: Emotional tone and sentiment analysis
/// - FinancialAgent: Financial metrics and business performance
/// - CompetitiveAgent: Competitive intelligence and market positioning
/// - SummaryAgent: Key insights and business impact analysis
/// - RiskAgent: Risk assessment and mitigation strategies

pub mod sentiment;
pub mod financial;
pub mod competitive;
pub mod summary;
pub mod risk;

pub use sentiment::SentimentAgent;
pub use financial::FinancialAgent;
pub use competitive::CompetitiveAgent;
pub use summary::SummaryAgent;
pub use risk::RiskAgent;