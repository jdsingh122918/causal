/// Database storage for embeddings and analysis results
///
/// Provides SQLite integration for storing analysis results with their
/// vector embeddings and performing similarity-based queries.

use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::time::SystemTime;
use tracing::{debug, info, warn};

/// Analysis result stored with embedding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisWithEmbedding {
    pub id: i64,
    pub recording_id: String,
    pub project_id: String,
    pub analysis_type: String,
    pub analysis_content: String,
    pub input_text: String,
    pub timestamp: SystemTime,
    pub embedding: Vec<f32>,
    pub embedding_model: String,
    pub confidence_score: Option<f32>,
    pub processing_time_ms: Option<i64>,
    pub context_length: Option<i64>,
}

/// Similar analysis result with similarity score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarAnalysis {
    pub id: i64,
    pub recording_id: String,
    pub project_id: String,
    pub analysis_type: String,
    pub analysis_content: String,
    pub input_text: String,
    pub timestamp: SystemTime,
    pub similarity_score: f32,
    pub confidence_score: Option<f32>,
}

/// Date range filter for queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start: SystemTime,
    pub end: SystemTime,
}

/// Helper to convert SystemTime to timestamp
fn system_time_to_timestamp(time: SystemTime) -> i64 {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

/// Helper to convert timestamp to SystemTime
fn timestamp_to_system_time(timestamp: i64) -> SystemTime {
    SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(timestamp as u64)
}

/// Convert embedding Vec<f32> to BLOB for storage
fn embedding_to_blob(embedding: &[f32]) -> Vec<u8> {
    embedding
        .iter()
        .flat_map(|&f| f.to_le_bytes())
        .collect()
}

/// Convert BLOB back to Vec<f32>
fn blob_to_embedding(blob: &[u8]) -> Vec<f32> {
    blob.chunks_exact(4)
        .map(|chunk| {
            let bytes = [chunk[0], chunk[1], chunk[2], chunk[3]];
            f32::from_le_bytes(bytes)
        })
        .collect()
}

/// Initialize the analysis_results table with embedding support
pub fn init_embeddings_schema(conn: &Connection) -> Result<(), String> {
    // Create analysis_results table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS analysis_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recording_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            analysis_type TEXT NOT NULL,
            analysis_content TEXT NOT NULL,
            input_text TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            embedding BLOB,
            embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',
            confidence_score REAL,
            processing_time_ms INTEGER,
            context_length INTEGER,
            FOREIGN KEY(recording_id) REFERENCES recordings(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )
    .map_err(|e| format!("Failed to create analysis_results table: {}", e))?;

    // Create indexes for efficient querying
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_analysis_project_type
         ON analysis_results(project_id, analysis_type)",
        [],
    )
    .map_err(|e| format!("Failed to create project_type index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_analysis_timestamp
         ON analysis_results(timestamp)",
        [],
    )
    .map_err(|e| format!("Failed to create timestamp index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_analysis_recording
         ON analysis_results(recording_id)",
        [],
    )
    .map_err(|e| format!("Failed to create recording index: {}", e))?;

    // Create embedding_models table for metadata
    conn.execute(
        "CREATE TABLE IF NOT EXISTS embedding_models (
            model_name TEXT PRIMARY KEY,
            dimensions INTEGER NOT NULL,
            model_path TEXT,
            version TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )
    .map_err(|e| format!("Failed to create embedding_models table: {}", e))?;

    // Insert default model metadata if not exists
    conn.execute(
        "INSERT OR IGNORE INTO embedding_models (model_name, dimensions, version)
         VALUES ('all-MiniLM-L6-v2', 384, '1.0')",
        [],
    )
    .map_err(|e| format!("Failed to insert default model metadata: {}", e))?;

    Ok(())
}

/// Store an analysis result with its embedding
pub fn store_analysis(
    conn: &Connection,
    recording_id: &str,
    project_id: &str,
    analysis_type: &str,
    analysis_content: &str,
    input_text: &str,
    embedding: &[f32],
    confidence_score: Option<f32>,
    processing_time_ms: Option<i64>,
) -> Result<i64, String> {
    let start_time = std::time::Instant::now();
    debug!("Storage: Storing analysis - type: {}, project: {}, embedding_dim: {}",
           analysis_type, project_id, embedding.len());

    let timestamp = system_time_to_timestamp(SystemTime::now());
    let embedding_blob = embedding_to_blob(embedding);
    let context_length = input_text.len() as i64;
    let blob_size = embedding_blob.len();

    debug!("Storage: Embedding converted to blob ({} bytes for {} dimensions)",
           blob_size, embedding.len());

    conn.execute(
        "INSERT INTO analysis_results
         (recording_id, project_id, analysis_type, analysis_content, input_text,
          timestamp, embedding, confidence_score, processing_time_ms, context_length)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            recording_id,
            project_id,
            analysis_type,
            analysis_content,
            input_text,
            timestamp,
            embedding_blob,
            confidence_score,
            processing_time_ms,
            context_length,
        ],
    )
    .map_err(|e| {
        warn!("Storage: Failed to insert analysis result: {}", e);
        format!("Failed to insert analysis result: {}", e)
    })?;

    let analysis_id = conn.last_insert_rowid();
    let duration = start_time.elapsed();
    info!("Storage: Successfully stored analysis {} in {:?} (blob_size: {} bytes, text_length: {})",
          analysis_id, duration, blob_size, context_length);

    Ok(analysis_id)
}

/// Retrieve all analysis results (with embeddings) for similarity search
pub fn get_all_analyses_with_embeddings(
    conn: &Connection,
    project_id: Option<&str>,
    analysis_type: Option<&str>,
    date_range: Option<DateRange>,
) -> Result<Vec<AnalysisWithEmbedding>, String> {
    let start_time = std::time::Instant::now();
    debug!("Storage: Retrieving analyses with embeddings - project: {:?}, type: {:?}",
           project_id, analysis_type);

    let mut query = String::from(
        "SELECT id, recording_id, project_id, analysis_type, analysis_content,
         input_text, timestamp, embedding, embedding_model, confidence_score,
         processing_time_ms, context_length
         FROM analysis_results WHERE 1=1"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(pid) = project_id {
        query.push_str(" AND project_id = ?");
        params_vec.push(Box::new(pid.to_string()));
    }

    if let Some(atype) = analysis_type {
        query.push_str(" AND analysis_type = ?");
        params_vec.push(Box::new(atype.to_string()));
    }

    if let Some(range) = date_range {
        query.push_str(" AND timestamp >= ? AND timestamp <= ?");
        params_vec.push(Box::new(system_time_to_timestamp(range.start)));
        params_vec.push(Box::new(system_time_to_timestamp(range.end)));
    }

    query.push_str(" ORDER BY timestamp DESC");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| {
            warn!("Storage: Failed to prepare query: {}", e);
            format!("Failed to prepare query: {}", e)
        })?;

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| &**b as &dyn rusqlite::ToSql).collect();

    let query_start = std::time::Instant::now();
    let results = stmt
        .query_map(params_refs.as_slice(), |row| {
            let embedding_blob: Vec<u8> = row.get(7)?;
            let embedding = blob_to_embedding(&embedding_blob);

            Ok(AnalysisWithEmbedding {
                id: row.get(0)?,
                recording_id: row.get(1)?,
                project_id: row.get(2)?,
                analysis_type: row.get(3)?,
                analysis_content: row.get(4)?,
                input_text: row.get(5)?,
                timestamp: timestamp_to_system_time(row.get(6)?),
                embedding,
                embedding_model: row.get(8)?,
                confidence_score: row.get(9)?,
                processing_time_ms: row.get(10)?,
                context_length: row.get(11)?,
            })
        })
        .map_err(|e| {
            warn!("Storage: Failed to query analyses: {}", e);
            format!("Failed to query analyses: {}", e)
        })?
        .collect::<SqlResult<Vec<_>>>()
        .map_err(|e| {
            warn!("Storage: Failed to collect analyses: {}", e);
            format!("Failed to collect analyses: {}", e)
        })?;

    let query_duration = query_start.elapsed();
    let total_duration = start_time.elapsed();
    let total_embedding_size: usize = results.iter().map(|r| r.embedding.len()).sum();

    info!("Storage: Retrieved {} analyses with embeddings in {:?} (query: {:?}, total_embedding_dims: {})",
          results.len(), total_duration, query_duration, total_embedding_size);

    Ok(results)
}

/// Get a specific analysis by ID
#[allow(dead_code)]
pub fn get_analysis_by_id(
    conn: &Connection,
    analysis_id: i64,
) -> Result<Option<AnalysisWithEmbedding>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, recording_id, project_id, analysis_type, analysis_content,
             input_text, timestamp, embedding, embedding_model, confidence_score,
             processing_time_ms, context_length
             FROM analysis_results WHERE id = ?1"
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let result = stmt
        .query_row(params![analysis_id], |row| {
            let embedding_blob: Vec<u8> = row.get(7)?;
            let embedding = blob_to_embedding(&embedding_blob);

            Ok(AnalysisWithEmbedding {
                id: row.get(0)?,
                recording_id: row.get(1)?,
                project_id: row.get(2)?,
                analysis_type: row.get(3)?,
                analysis_content: row.get(4)?,
                input_text: row.get(5)?,
                timestamp: timestamp_to_system_time(row.get(6)?),
                embedding,
                embedding_model: row.get(8)?,
                confidence_score: row.get(9)?,
                processing_time_ms: row.get(10)?,
                context_length: row.get(11)?,
            })
        });

    match result {
        Ok(analysis) => Ok(Some(analysis)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Get analysis count by project and type
#[allow(dead_code)]
pub fn get_analysis_count(
    conn: &Connection,
    project_id: Option<&str>,
    analysis_type: Option<&str>,
) -> Result<usize, String> {
    let mut query = String::from("SELECT COUNT(*) FROM analysis_results WHERE 1=1");
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(pid) = project_id {
        query.push_str(" AND project_id = ?");
        params_vec.push(Box::new(pid.to_string()));
    }

    if let Some(atype) = analysis_type {
        query.push_str(" AND analysis_type = ?");
        params_vec.push(Box::new(atype.to_string()));
    }

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| &**b as &dyn rusqlite::ToSql).collect();

    let count: usize = conn
        .query_row(&query, params_refs.as_slice(), |row| row.get(0))
        .unwrap_or(0);

    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedding_blob_conversion() {
        let original = vec![1.0, -0.5, 0.0, 0.75];
        let blob = embedding_to_blob(&original);
        let recovered = blob_to_embedding(&blob);

        assert_eq!(original.len(), recovered.len());
        for (a, b) in original.iter().zip(recovered.iter()) {
            assert!((a - b).abs() < 1e-6);
        }
    }

    #[test]
    fn test_system_time_conversion() {
        let now = SystemTime::now();
        let timestamp = system_time_to_timestamp(now);
        let recovered = timestamp_to_system_time(timestamp);

        let diff = now.duration_since(recovered).unwrap_or_default();
        assert!(diff.as_secs() < 1); // Within 1 second
    }
}
