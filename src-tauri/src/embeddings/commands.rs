/// Tauri commands for embeddings and semantic search functionality

use super::service::EmbeddingService;
use super::storage::{DateRange, SimilarAnalysis};
use crate::database::Database;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use tauri::{Manager, State};
use tracing::{debug, info};

/// Application state for embeddings service
pub struct EmbeddingsState {
    pub service: Arc<Mutex<Option<EmbeddingService>>>,
}

impl Default for EmbeddingsState {
    fn default() -> Self {
        Self {
            service: Arc::new(Mutex::new(None)),
        }
    }
}

/// Search filters for semantic search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub project_id: Option<String>,
    pub analysis_types: Option<Vec<String>>,
    pub date_range: Option<DateRangeFilter>,
    pub top_k: Option<usize>,
    pub min_similarity: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRangeFilter {
    pub start_timestamp: i64,
    pub end_timestamp: i64,
}

impl From<DateRangeFilter> for DateRange {
    fn from(filter: DateRangeFilter) -> Self {
        DateRange {
            start: SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(filter.start_timestamp as u64),
            end: SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(filter.end_timestamp as u64),
        }
    }
}

/// Analysis trend data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisTrend {
    pub date: String,
    pub count: usize,
    pub avg_confidence: Option<f32>,
}

/// Store an analysis result with embedding
#[tauri::command]
pub async fn store_analysis_with_embedding(
    embeddings_state: State<'_, Mutex<EmbeddingsState>>,
    database: State<'_, Database>,
    recording_id: String,
    project_id: String,
    analysis_type: String,
    analysis_content: String,
    input_text: String,
    confidence_score: Option<f32>,
    processing_time_ms: Option<i64>,
) -> Result<i64, String> {
    info!("Storing analysis result with embedding for recording {}", recording_id);

    // Get database connection first
    let conn_guard = database.get_connection().await;

    // Get embedding service (after await to avoid holding MutexGuard across await)
    let service_arc = {
        let state = embeddings_state.lock()
            .map_err(|e| format!("Failed to lock embeddings state: {}", e))?;
        state.service.clone()
    };

    let service_guard = service_arc.lock()
        .map_err(|e| format!("Failed to lock embedding service: {}", e))?;

    let service = service_guard.as_ref()
        .ok_or("Embedding service not initialized")?;

    // Store analysis with embedding
    let analysis_id = service.store_analysis_with_embedding(
        &conn_guard,
        &recording_id,
        &project_id,
        &analysis_type,
        &analysis_content,
        &input_text,
        confidence_score,
        processing_time_ms,
    )?;

    info!("Stored analysis {} with embedding", analysis_id);

    Ok(analysis_id)
}

/// Search for similar analyses using semantic search
#[tauri::command]
pub async fn search_analyses_semantic(
    embeddings_state: State<'_, Mutex<EmbeddingsState>>,
    database: State<'_, Database>,
    query: String,
    filters: SearchFilters,
) -> Result<Vec<SimilarAnalysis>, String> {
    info!("Semantic search for: '{}'", query);

    // Get database connection first
    let conn_guard = database.get_connection().await;

    // Get embedding service (after await to avoid holding MutexGuard across await)
    let service_arc = {
        let state = embeddings_state.lock()
            .map_err(|e| format!("Failed to lock embeddings state: {}", e))?;
        state.service.clone()
    };

    let service_guard = service_arc.lock()
        .map_err(|e| format!("Failed to lock embedding service: {}", e))?;

    let service = service_guard.as_ref()
        .ok_or("Embedding service not initialized")?;

    // Convert date range filter if present
    let date_range = filters.date_range.map(|dr| dr.into());

    // Extract first analysis type if filter has multiple
    let analysis_type = filters.analysis_types
        .as_ref()
        .and_then(|types| types.first())
        .map(|s| s.as_str());

    // Perform semantic search
    let results = service.find_similar_analyses(
        &conn_guard,
        &query,
        filters.project_id.as_deref(),
        analysis_type,
        date_range,
        filters.top_k.unwrap_or(10),
        filters.min_similarity.unwrap_or(0.6),
    )?;

    info!("Found {} similar analyses", results.len());

    Ok(results)
}

/// Get historical context for analysis
#[tauri::command]
pub async fn get_analysis_context(
    embeddings_state: State<'_, Mutex<EmbeddingsState>>,
    database: State<'_, Database>,
    text: String,
    project_id: String,
    analysis_type: String,
    context_size: Option<usize>,
) -> Result<String, String> {
    debug!("Getting historical context for analysis");

    // Get database connection first
    let conn_guard = database.get_connection().await;

    // Get embedding service (after await to avoid holding MutexGuard across await)
    let service_arc = {
        let state = embeddings_state.lock()
            .map_err(|e| format!("Failed to lock embeddings state: {}", e))?;
        state.service.clone()
    };

    let service_guard = service_arc.lock()
        .map_err(|e| format!("Failed to lock embedding service: {}", e))?;

    let service = service_guard.as_ref()
        .ok_or("Embedding service not initialized")?;

    // Get historical context
    let context = service.get_historical_context(
        &conn_guard,
        &text,
        &project_id,
        &analysis_type,
        context_size.unwrap_or(3),
    )?;

    Ok(context)
}

/// Get analysis trends over time
#[tauri::command]
pub async fn get_analysis_trends(
    database: State<'_, Database>,
    project_id: String,
    analysis_type: String,
    days: Option<usize>,
) -> Result<Vec<AnalysisTrend>, String> {
    info!("Getting analysis trends for project {}, type {}", project_id, analysis_type);

    let conn_guard = database.get_connection().await;

    let days_back = days.unwrap_or(30);
    let start_timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64 - (days_back as i64 * 86400);

    // Query for trend data grouped by date
    let mut stmt = conn_guard
        .prepare(
            "SELECT DATE(timestamp, 'unixepoch') as date,
                    COUNT(*) as count,
                    AVG(confidence_score) as avg_confidence
             FROM analysis_results
             WHERE project_id = ?1 AND analysis_type = ?2 AND timestamp >= ?3
             GROUP BY date
             ORDER BY date ASC"
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let trends = stmt
        .query_map(
            rusqlite::params![project_id, analysis_type, start_timestamp],
            |row| {
                Ok(AnalysisTrend {
                    date: row.get(0)?,
                    count: row.get(1)?,
                    avg_confidence: row.get(2)?,
                })
            },
        )
        .map_err(|e| format!("Failed to query trends: {}", e))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| format!("Failed to collect trends: {}", e))?;

    info!("Found {} trend data points", trends.len());

    Ok(trends)
}

/// Get analysis statistics
#[tauri::command]
pub async fn get_analysis_stats(
    database: State<'_, Database>,
    project_id: Option<String>,
) -> Result<serde_json::Value, String> {
    debug!("Getting analysis statistics");

    let conn_guard = database.get_connection().await;

    let mut query = String::from(
        "SELECT analysis_type,
                COUNT(*) as count,
                AVG(confidence_score) as avg_confidence,
                AVG(processing_time_ms) as avg_processing_time
         FROM analysis_results"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(pid) = &project_id {
        query.push_str(" WHERE project_id = ?");
        params_vec.push(Box::new(pid.clone()));
    }

    query.push_str(" GROUP BY analysis_type");

    let mut stmt = conn_guard
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| &**b as &dyn rusqlite::ToSql).collect();

    let stats = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(serde_json::json!({
                "analysis_type": row.get::<_, String>(0)?,
                "count": row.get::<_, i64>(1)?,
                "avg_confidence": row.get::<_, Option<f32>>(2)?,
                "avg_processing_time_ms": row.get::<_, Option<i64>>(3)?,
            }))
        })
        .map_err(|e| format!("Failed to query stats: {}", e))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| format!("Failed to collect stats: {}", e))?;

    // Get total count
    let total_count: i64 = if let Some(pid) = &project_id {
        conn_guard
            .query_row(
                "SELECT COUNT(*) FROM analysis_results WHERE project_id = ?1",
                rusqlite::params![pid],
                |row| row.get(0),
            )
            .unwrap_or(0)
    } else {
        conn_guard
            .query_row("SELECT COUNT(*) FROM analysis_results", [], |row| row.get(0))
            .unwrap_or(0)
    };

    Ok(serde_json::json!({
        "total_count": total_count,
        "by_type": stats,
    }))
}

/// Initialize embeddings service
#[tauri::command]
pub async fn initialize_embeddings_service(
    embeddings_state: State<'_, Mutex<EmbeddingsState>>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    info!("Initializing embeddings service");

    // Get resource directory for model files
    let resource_dir = app_handle.path().resource_dir()
        .map_err(|e| format!("Failed to get resource directory: {}", e))?;

    let model_path = resource_dir.join("models").join("all-MiniLM-L6-v2").join("model.onnx");
    let tokenizer_path = resource_dir.join("models").join("all-MiniLM-L6-v2").join("tokenizer.json");

    // Check if model files exist
    if !model_path.exists() {
        return Err(format!("Model file not found at {:?}", model_path));
    }

    if !tokenizer_path.exists() {
        return Err(format!("Tokenizer file not found at {:?}", tokenizer_path));
    }

    // Create embedding service
    let service = EmbeddingService::new(model_path, tokenizer_path);

    // Initialize the model
    service.initialize()?;

    // Store in state
    let mut state = embeddings_state.lock()
        .map_err(|e| format!("Failed to lock embeddings state: {}", e))?;

    state.service = Arc::new(Mutex::new(Some(service)));

    info!("Embeddings service initialized successfully");

    Ok("Embeddings service initialized successfully".to_string())
}

/// Check if embeddings service is initialized
#[tauri::command]
pub async fn is_embeddings_initialized(
    embeddings_state: State<'_, Mutex<EmbeddingsState>>,
) -> Result<bool, String> {
    let state = embeddings_state.lock()
        .map_err(|e| format!("Failed to lock embeddings state: {}", e))?;

    let service_guard = state.service.lock()
        .map_err(|e| format!("Failed to lock service: {}", e))?;

    Ok(service_guard.as_ref().map(|s| s.is_initialized()).unwrap_or(false))
}
