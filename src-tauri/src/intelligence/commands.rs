/// Tauri commands for Business Intelligence functionality
///
/// This module provides the command interface between the React frontend and the
/// Rust intelligence system. Commands handle configuration, status monitoring,
/// and on-demand analysis requests.

use super::types::*;
use super::coordinator::IntelligenceCoordinator;
use super::agents::*;
use crate::transcription::buffer::TranscriptionBuffer;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tracing::{debug, error, info, warn};

/// Application state for the intelligence system
#[derive(Default)]
pub struct IntelligenceState {
    pub coordinator: Option<Arc<Mutex<IntelligenceCoordinator>>>,
    pub config: IntelligenceConfig,
    pub is_running: bool,
}

/// Get current intelligence configuration
#[tauri::command]
pub fn get_intelligence_config(
    intelligence_state: State<Mutex<IntelligenceState>>
) -> Result<IntelligenceConfig, String> {
    let state = intelligence_state.lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    debug!("🧠 Getting intelligence configuration");
    Ok(state.config.clone())
}

/// Update intelligence configuration
#[tauri::command]
pub fn set_intelligence_config(
    intelligence_state: State<Mutex<IntelligenceState>>,
    config: IntelligenceConfig
) -> Result<String, String> {
    let mut state = intelligence_state.lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    info!(
        "🧠 Updating intelligence configuration: {} agents enabled, model: {}",
        config.enabled_analyses.len(),
        config.model
    );

    // Validate configuration
    if config.api_key.is_empty() {
        return Err("API key is required for intelligence analysis".to_string());
    }

    if config.enabled_analyses.is_empty() {
        return Err("At least one analysis type must be enabled".to_string());
    }

    state.config = config;

    // Invalidate coordinator to force recreation with new config
    state.coordinator = None;

    Ok("Intelligence configuration updated successfully".to_string())
}

/// Get intelligence system status
#[tauri::command]
pub fn get_intelligence_status(
    intelligence_state: State<Mutex<IntelligenceState>>
) -> Result<serde_json::Value, String> {
    let state = intelligence_state.lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    debug!("🧠 Getting intelligence status");

    let status = serde_json::json!({
        "is_running": state.is_running,
        "enabled_analyses": state.config.enabled_analyses.iter()
            .map(|a| a.as_str())
            .collect::<Vec<_>>(),
        "agent_count": state.config.enabled_analyses.len(),
        "model": state.config.model,
        "concurrent_agents": state.config.concurrent_agents,
        "has_coordinator": state.coordinator.is_some(),
        "has_api_key": !state.config.api_key.is_empty(),
    });

    Ok(status)
}

/// Initialize the intelligence system with current configuration
#[tauri::command]
pub fn initialize_intelligence_system(
    intelligence_state: State<Mutex<IntelligenceState>>
) -> Result<String, String> {
    let mut state = intelligence_state.lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    if state.config.api_key.is_empty() {
        return Err("Cannot initialize: API key is required".to_string());
    }

    if state.config.enabled_analyses.is_empty() {
        return Err("Cannot initialize: No analysis types enabled".to_string());
    }

    info!("🧠 Initializing intelligence system with {} agents", state.config.enabled_analyses.len());

    // Create new coordinator with current config
    let mut coordinator = IntelligenceCoordinator::new(state.config.clone());

    // Register agents based on enabled analyses
    for analysis_type in &state.config.enabled_analyses {
        let agent: Arc<dyn IntelligenceAgent> = match analysis_type {
            AnalysisType::Sentiment => Arc::new(SentimentAgent::new(state.config.api_key.clone())),
            AnalysisType::Financial => Arc::new(FinancialAgent::new(state.config.api_key.clone())),
            AnalysisType::Competitive => Arc::new(CompetitiveAgent::new(state.config.api_key.clone())),
            AnalysisType::Summary => Arc::new(SummaryAgent::new(state.config.api_key.clone())),
            AnalysisType::Risk => Arc::new(RiskAgent::new(state.config.api_key.clone())),
        };

        coordinator.register_agent(agent);
    }

    // Validate setup
    coordinator.validate_setup()?;

    state.coordinator = Some(Arc::new(Mutex::new(coordinator)));

    info!("✅ Intelligence system initialized successfully");
    Ok("Intelligence system initialized successfully".to_string())
}

/// Analyze a text buffer on-demand (useful for testing and manual analysis)
#[tauri::command]
pub async fn analyze_text_buffer(
    intelligence_state: State<'_, Mutex<IntelligenceState>>,
    app: AppHandle,
    buffer_id: u32,
    text: String,
) -> Result<CombinedIntelligence, String> {
    let (config, enabled_analyses) = {
        let state = intelligence_state.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        if state.config.api_key.is_empty() {
            return Err("Intelligence system not configured. Set API key first.".to_string());
        }

        if state.config.enabled_analyses.is_empty() {
            return Err("No analysis types enabled.".to_string());
        }

        (state.config.clone(), state.config.enabled_analyses.clone())
    };

    info!("🧠 Starting manual text analysis for buffer {}", buffer_id);

    // Create a mock transcription buffer for analysis
    let buffer = TranscriptionBuffer {
        turn_order: buffer_id,
        texts: vec![text.clone()],
        start_time: Instant::now(),
        end_time: Instant::now(),
        is_complete: true,
    };

    // Run analysis with individual agents (avoid coordinator mutex issues)
    let mut results = HashMap::new();

    for analysis_type in &enabled_analyses {
        let result = match analysis_type {
            AnalysisType::Sentiment => {
                let agent = SentimentAgent::new(config.api_key.clone());
                agent.analyze(&buffer).await
            },
            AnalysisType::Financial => {
                let agent = FinancialAgent::new(config.api_key.clone());
                agent.analyze(&buffer).await
            },
            AnalysisType::Competitive => {
                let agent = CompetitiveAgent::new(config.api_key.clone());
                agent.analyze(&buffer).await
            },
            AnalysisType::Summary => {
                let agent = SummaryAgent::new(config.api_key.clone());
                agent.analyze(&buffer).await
            },
            AnalysisType::Risk => {
                let agent = RiskAgent::new(config.api_key.clone());
                agent.analyze(&buffer).await
            },
        };

        match result {
            Ok(analysis_result) => {
                results.insert(*analysis_type, analysis_result);
            },
            Err(e) => {
                warn!("Agent {:?} failed: {}", analysis_type, e);
            }
        }
    }

    let combined_result = CombinedIntelligence {
        buffer_id,
        timestamp: chrono::Utc::now(),
        processing_complete: results.len() == enabled_analyses.len(),
        results: results.clone(),
    };

    // Emit intelligence events to frontend
    for (analysis_type, intelligence_result) in &results {
        let event = IntelligenceEvent {
            buffer_id,
            analysis_type: *analysis_type,
            result: intelligence_result.clone(),
            all_analyses_complete: combined_result.processing_complete,
        };

        if let Err(e) = app.emit("intelligence_result", &event) {
            warn!("Failed to emit intelligence event: {}", e);
        }
    }

    info!(
        "✅ Manual text analysis complete for buffer {}: {}/{} agents succeeded",
        buffer_id,
        results.len(),
        enabled_analyses.len()
    );

    Ok(combined_result)
}

/// Get available analysis types
#[tauri::command]
pub fn get_available_analysis_types() -> Result<Vec<serde_json::Value>, String> {
    debug!("🧠 Getting available analysis types");

    let types = vec![
        serde_json::json!({
            "type": "sentiment",
            "name": "Sentiment Analysis",
            "description": "Analyzes emotional tone, confidence levels, and key sentiment drivers",
            "output": ["overall_sentiment", "confidence", "emotional_tone", "key_phrases"]
        }),
        serde_json::json!({
            "type": "financial",
            "name": "Financial Analysis",
            "description": "Extracts financial metrics, currencies, growth rates, and business outlook",
            "output": ["metrics", "currencies", "percentages", "financial_terms", "outlook"]
        }),
        serde_json::json!({
            "type": "competitive",
            "name": "Competitive Intelligence",
            "description": "Identifies competitors, market positioning, and competitive advantages",
            "output": ["competitors_mentioned", "competitive_positioning", "market_share_mentions", "competitive_advantages", "threats_identified"]
        }),
        serde_json::json!({
            "type": "summary",
            "name": "Summary & Insights",
            "description": "Extracts key points, action items, decisions, and business impact",
            "output": ["key_points", "action_items", "decisions_made", "business_impact", "follow_up_required"]
        }),
        serde_json::json!({
            "type": "risk",
            "name": "Risk Analysis",
            "description": "Identifies business risks, risk levels, and mitigation strategies",
            "output": ["risks_identified", "risk_level", "mitigation_strategies", "regulatory_concerns"]
        }),
    ];

    Ok(types)
}

/// Clear intelligence system state (useful for cleanup)
#[tauri::command]
pub fn clear_intelligence_system(
    intelligence_state: State<Mutex<IntelligenceState>>
) -> Result<String, String> {
    let mut state = intelligence_state.lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    info!("🧠 Clearing intelligence system state");

    state.coordinator = None;
    state.is_running = false;

    Ok("Intelligence system cleared successfully".to_string())
}

/// Test intelligence system connectivity (useful for debugging)
#[tauri::command]
pub async fn test_intelligence_connectivity(
    intelligence_state: State<'_, Mutex<IntelligenceState>>
) -> Result<serde_json::Value, String> {
    let (api_key, test_text) = {
        let state = intelligence_state.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        debug!("🧠 Testing intelligence connectivity");

        if state.config.api_key.is_empty() {
            return Err("No API key configured".to_string());
        }

        let test_text = "This is a test for connectivity and basic functionality.";
        (state.config.api_key.clone(), test_text.to_string())
    };

    // Create a simple sentiment agent for testing
    let test_agent = SentimentAgent::new(api_key);

    let test_buffer = TranscriptionBuffer {
        turn_order: 0,
        texts: vec![test_text],
        start_time: Instant::now(),
        end_time: Instant::now(),
        is_complete: true,
    };

    let start_time = std::time::Instant::now();

    match test_agent.analyze(&test_buffer).await {
        Ok(result) => {
            let response_time = start_time.elapsed();

            info!("✅ Intelligence connectivity test successful in {:?}", response_time);

            Ok(serde_json::json!({
                "status": "success",
                "response_time_ms": response_time.as_millis(),
                "model_used": result.model_used,
                "processing_time_ms": result.processing_time_ms,
                "test_completed": true
            }))
        },
        Err(e) => {
            error!("❌ Intelligence connectivity test failed: {}", e);

            Ok(serde_json::json!({
                "status": "failed",
                "error": e,
                "test_completed": false
            }))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_intelligence_config() {
        let config = IntelligenceConfig::default();
        assert!(!config.enabled_analyses.is_empty());
        assert_eq!(config.model, "claude-haiku-4-5-20251001");
        assert_eq!(config.concurrent_agents, 4);
    }

    #[test]
    fn test_analysis_types_conversion() {
        assert_eq!(AnalysisType::Sentiment.as_str(), "sentiment");
        assert_eq!(AnalysisType::Financial.as_str(), "financial");
        assert_eq!(AnalysisType::Competitive.as_str(), "competitive");
        assert_eq!(AnalysisType::Summary.as_str(), "summary");
        assert_eq!(AnalysisType::Risk.as_str(), "risk");
    }
}