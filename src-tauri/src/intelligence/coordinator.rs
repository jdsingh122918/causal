use crate::intelligence::types::*;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::info;

/// Coordinates multiple intelligence agents for parallel processing
pub struct IntelligenceCoordinator {
    agents: HashMap<AnalysisType, Arc<dyn IntelligenceAgent>>,
    config: IntelligenceConfig,
}

impl IntelligenceCoordinator {
    /// Create a new intelligence coordinator
    pub fn new(config: IntelligenceConfig) -> Self {
        Self {
            agents: HashMap::new(),
            config,
        }
    }

    /// Register an intelligence agent
    pub fn register_agent(&mut self, agent: Arc<dyn IntelligenceAgent>) {
        let analysis_type = agent.analysis_type();
        info!(
            "🧠 Registering intelligence agent: {} (model: {})",
            analysis_type.as_str(),
            agent.model()
        );
        self.agents.insert(analysis_type, agent);
    }

    /// Check if all required agents are registered
    pub fn validate_setup(&self) -> Result<(), String> {
        for analysis_type in &self.config.enabled_analyses {
            if !self.agents.contains_key(analysis_type) {
                return Err(format!(
                    "Missing agent for analysis type: {}",
                    analysis_type.as_str()
                ));
            }
        }
        Ok(())
    }





    /// Get agent count
    #[allow(dead_code)] // Used in tests
    pub fn agent_count(&self) -> usize {
        self.agents.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transcription::buffer::TranscriptionBuffer;
    use async_trait::async_trait;

    struct MockAgent {
        analysis_type: AnalysisType,
    }

    #[async_trait]
    impl IntelligenceAgent for MockAgent {
        async fn analyze(&self, buffer: &TranscriptionBuffer) -> Result<IntelligenceResult, String> {
            Ok(IntelligenceResult {
                buffer_id: buffer.turn_order,
                analysis_type: self.analysis_type,
                processing_time_ms: 100,
                model_used: "mock-model".to_string(),
                raw_text: buffer.combined_text(),
                timestamp: chrono::Utc::now(),
                sentiment: None,
                financial: None,
                competitive: None,
                summary: None,
                risk: None,
            })
        }

        fn analysis_type(&self) -> AnalysisType {
            self.analysis_type
        }

        fn model(&self) -> &str {
            "mock-model"
        }
    }

    #[tokio::test]
    async fn test_coordinator_creation() {
        let config = IntelligenceConfig::default();
        let coordinator = IntelligenceCoordinator::new(config);
        assert_eq!(coordinator.agent_count(), 0);
    }

    #[tokio::test]
    async fn test_agent_registration() {
        let config = IntelligenceConfig::default();
        let mut coordinator = IntelligenceCoordinator::new(config);

        let agent = Arc::new(MockAgent {
            analysis_type: AnalysisType::Sentiment,
        });
        coordinator.register_agent(agent);

        assert_eq!(coordinator.agent_count(), 1);
    }
}