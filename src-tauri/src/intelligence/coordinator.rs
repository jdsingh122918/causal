use crate::intelligence::types::*;
use crate::transcription::buffer::TranscriptionBuffer;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tracing::{debug, info, warn};

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

    /// Process a buffer through all enabled intelligence agents in parallel
    pub async fn analyze_buffer(
        &self,
        buffer: TranscriptionBuffer,
    ) -> Result<CombinedIntelligence, String> {
        let buffer_id = buffer.turn_order;
        let start_time = std::time::Instant::now();

        info!(
            "🧠 Starting intelligence analysis for buffer {} with {} agents",
            buffer_id,
            self.config.enabled_analyses.len()
        );

        // Create a channel to collect results from all agents
        let (result_tx, mut result_rx) = mpsc::unbounded_channel::<IntelligenceResult>();
        let mut agent_tasks = Vec::new();

        // Launch all enabled agents in parallel
        for analysis_type in &self.config.enabled_analyses {
            if let Some(agent) = self.agents.get(analysis_type) {
                let agent_clone = Arc::clone(agent);
                let buffer_clone = buffer.clone();
                let tx = result_tx.clone();
                let analysis_type_str = analysis_type.as_str().to_string(); // Clone the string

                let task = tokio::spawn(async move {
                    let agent_start = std::time::Instant::now();
                    debug!(
                        "🔍 Agent {} starting analysis for buffer {}",
                        analysis_type_str,
                        buffer_id
                    );

                    match agent_clone.analyze(&buffer_clone).await {
                        Ok(result) => {
                            let agent_duration = agent_start.elapsed();
                            debug!(
                                "✅ Agent {} completed analysis for buffer {} in {:?}",
                                analysis_type_str,
                                buffer_id,
                                agent_duration
                            );
                            let _ = tx.send(result);
                        }
                        Err(e) => {
                            warn!(
                                "❌ Agent {} failed for buffer {}: {}",
                                analysis_type_str,
                                buffer_id,
                                e
                            );
                        }
                    }
                });

                agent_tasks.push(task);
            }
        }

        // Drop the sender so the receiver knows when all agents are done
        drop(result_tx);

        // Collect results from all agents
        let mut results = HashMap::new();
        while let Some(result) = result_rx.recv().await {
            results.insert(result.analysis_type, result);
        }

        // Wait for all agent tasks to complete
        for task in agent_tasks {
            if let Err(e) = task.await {
                warn!("Agent task failed: {}", e);
            }
        }

        let total_duration = start_time.elapsed();
        let processing_complete = results.len() == self.config.enabled_analyses.len();

        info!(
            "🧠 Intelligence analysis for buffer {} complete: {}/{} agents succeeded in {:?}",
            buffer_id,
            results.len(),
            self.config.enabled_analyses.len(),
            total_duration
        );

        Ok(CombinedIntelligence {
            buffer_id,
            timestamp: chrono::Utc::now(),
            results,
            processing_complete,
        })
    }

    /// Start the intelligence processing pipeline
    pub async fn start_pipeline(
        &self,
        buffer_rx: mpsc::UnboundedReceiver<TranscriptionBuffer>,
        intelligence_tx: mpsc::UnboundedSender<IntelligenceEvent>,
    ) -> Result<(), String> {
        self.validate_setup()?;

        info!(
            "🚀 Starting intelligence pipeline with {} concurrent processors",
            self.config.concurrent_agents
        );

        // Create shared receiver for worker pool pattern (similar to enhancement workers)
        let shared_buffer_rx = Arc::new(Mutex::new(buffer_rx));
        let mut worker_handles = Vec::with_capacity(self.config.concurrent_agents);

        // Spawn worker tasks for parallel processing
        for worker_id in 0..self.config.concurrent_agents {
            let shared_rx = Arc::clone(&shared_buffer_rx);
            let coordinator = self.clone_for_worker();
            let tx = intelligence_tx.clone();

            let worker_handle = tokio::spawn(async move {
                debug!("🧠 Intelligence worker {} started", worker_id);

                loop {
                    // Get next buffer from shared receiver
                    let buffer = {
                        let mut rx = shared_rx.lock().await;
                        rx.recv().await
                    };

                    match buffer {
                        Some(buffer) => {
                            let buffer_id = buffer.turn_order;

                            match coordinator.analyze_buffer(buffer).await {
                                Ok(combined) => {
                                    // Emit individual results as events
                                    for (analysis_type, result) in combined.results {
                                        let event = IntelligenceEvent {
                                            buffer_id,
                                            analysis_type,
                                            result,
                                            all_analyses_complete: combined.processing_complete,
                                        };

                                        if let Err(e) = tx.send(event) {
                                            warn!(
                                                "Failed to send intelligence event for buffer {}: {}",
                                                buffer_id, e
                                            );
                                        }
                                    }
                                }
                                Err(e) => {
                                    warn!(
                                        "Worker {} failed to analyze buffer {}: {}",
                                        worker_id, buffer_id, e
                                    );
                                }
                            }
                        }
                        None => {
                            debug!("🧠 Intelligence worker {} shutting down", worker_id);
                            break;
                        }
                    }
                }
            });

            worker_handles.push(worker_handle);
        }

        // Wait for all workers to complete
        for handle in worker_handles {
            if let Err(e) = handle.await {
                warn!("Intelligence worker failed: {}", e);
            }
        }

        info!("🧠 Intelligence pipeline shut down");
        Ok(())
    }

    /// Create a clone of this coordinator for use in worker tasks
    fn clone_for_worker(&self) -> Self {
        Self {
            agents: self.agents.clone(),
            config: self.config.clone(),
        }
    }

    /// Get enabled analysis types
    pub fn enabled_analyses(&self) -> &[AnalysisType] {
        &self.config.enabled_analyses
    }

    /// Get agent count
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