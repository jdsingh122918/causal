/// High-level embedding service for the application
///
/// Provides a unified interface for embedding generation, similarity search,
/// and integration with the database layer.

use super::model::EmbeddingModel;
use super::similarity::find_similar;
use super::storage::{
    get_all_analyses_with_embeddings, store_analysis, DateRange,
    SimilarAnalysis,
};
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tracing::{debug, info, warn};

/// Main embedding service handling all embedding-related operations
pub struct EmbeddingService {
    model: Arc<Mutex<Option<EmbeddingModel>>>,
    model_path: PathBuf,
    tokenizer_path: PathBuf,
}

impl EmbeddingService {
    /// Create a new embedding service
    ///
    /// # Arguments
    /// * `model_path` - Path to the ONNX model file
    /// * `tokenizer_path` - Path to the tokenizer JSON file
    pub fn new(model_path: PathBuf, tokenizer_path: PathBuf) -> Self {
        Self {
            model: Arc::new(Mutex::new(None)),
            model_path,
            tokenizer_path,
        }
    }

    /// Initialize the embedding model (lazy loading)
    pub fn initialize(&self) -> Result<(), String> {
        let mut model_lock = self.model.lock()
            .map_err(|e| format!("Failed to acquire model lock: {}", e))?;

        if model_lock.is_some() {
            debug!("Embedding model already initialized");
            return Ok(());
        }

        info!("Initializing embedding model from {:?}", self.model_path);

        let model = EmbeddingModel::new(&self.model_path, &self.tokenizer_path)?;

        *model_lock = Some(model);

        info!("Embedding model initialized successfully");

        Ok(())
    }

    /// Generate embedding for a single text
    ///
    /// # Arguments
    /// * `text` - Text to embed
    ///
    /// # Returns
    /// 384-dimensional embedding vector
    pub fn generate_embedding(&self, text: &str) -> Result<Vec<f32>, String> {
        debug!("EmbeddingService: Generating embedding for text (length: {} chars)", text.len());

        // Ensure model is initialized
        if self.model.lock().map_err(|e| format!("Lock error: {}", e))?.is_none() {
            info!("EmbeddingService: Model not initialized, initializing now");
            self.initialize()?;
        }

        let model_lock = self.model.lock()
            .map_err(|e| {
                warn!("EmbeddingService: Failed to acquire model lock: {}", e);
                format!("Failed to acquire model lock: {}", e)
            })?;

        let model = model_lock.as_ref()
            .ok_or_else(|| {
                warn!("EmbeddingService: Embedding model not initialized");
                "Embedding model not initialized".to_string()
            })?;

        let result = model.encode(text);

        match &result {
            Ok(embedding) => {
                debug!("EmbeddingService: Successfully generated {}-dimensional embedding", embedding.len());
            }
            Err(e) => {
                warn!("EmbeddingService: Failed to generate embedding: {}", e);
            }
        }

        result
    }

    /// Generate embeddings for multiple texts
    ///
    /// # Arguments
    /// * `texts` - Vector of texts to embed
    ///
    /// # Returns
    /// Vector of embedding vectors
    #[allow(dead_code)]
    pub fn generate_embeddings(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, String> {
        info!("EmbeddingService: Generating embeddings for {} texts", texts.len());

        // Ensure model is initialized
        if self.model.lock().map_err(|e| format!("Lock error: {}", e))?.is_none() {
            info!("EmbeddingService: Model not initialized, initializing now");
            self.initialize()?;
        }

        let model_lock = self.model.lock()
            .map_err(|e| {
                warn!("EmbeddingService: Failed to acquire model lock: {}", e);
                format!("Failed to acquire model lock: {}", e)
            })?;

        let model = model_lock.as_ref()
            .ok_or_else(|| {
                warn!("EmbeddingService: Embedding model not initialized");
                "Embedding model not initialized".to_string()
            })?;

        let result = model.encode_batch(texts);

        match &result {
            Ok(embeddings) => {
                info!("EmbeddingService: Successfully generated {} embeddings", embeddings.len());
            }
            Err(e) => {
                warn!("EmbeddingService: Batch embedding generation failed: {}", e);
            }
        }

        result
    }

    /// Store an analysis result with its embedding
    pub fn store_analysis_with_embedding(
        &self,
        conn: &Connection,
        recording_id: &str,
        project_id: &str,
        analysis_type: &str,
        analysis_content: &str,
        input_text: &str,
        confidence_score: Option<f32>,
        processing_time_ms: Option<i64>,
    ) -> Result<i64, String> {
        let start_time = std::time::Instant::now();
        info!("EmbeddingService: Storing analysis with embedding - type: {}, project: {}, text length: {}",
              analysis_type, project_id, input_text.len());

        // Generate embedding for the input text
        let embed_start = std::time::Instant::now();
        let embedding = self.generate_embedding(input_text)?;
        let embed_duration = embed_start.elapsed();
        debug!("EmbeddingService: Embedding generation took {:?}", embed_duration);

        // Store in database
        let store_start = std::time::Instant::now();
        let result = store_analysis(
            conn,
            recording_id,
            project_id,
            analysis_type,
            analysis_content,
            input_text,
            &embedding,
            confidence_score,
            processing_time_ms,
        );
        let store_duration = store_start.elapsed();

        match &result {
            Ok(analysis_id) => {
                let total_duration = start_time.elapsed();
                info!("EmbeddingService: Successfully stored analysis {} with embedding in {:?} (embedding: {:?}, storage: {:?})",
                      analysis_id, total_duration, embed_duration, store_duration);
            }
            Err(e) => {
                warn!("EmbeddingService: Failed to store analysis with embedding: {}", e);
            }
        }

        result
    }

    /// Find similar analyses using semantic search
    ///
    /// # Arguments
    /// * `conn` - Database connection
    /// * `query_text` - Text to search for
    /// * `project_id` - Optional project filter
    /// * `analysis_type` - Optional analysis type filter
    /// * `date_range` - Optional date range filter
    /// * `top_k` - Number of results to return
    /// * `min_similarity` - Minimum similarity threshold
    ///
    /// # Returns
    /// Vector of similar analyses with similarity scores
    pub fn find_similar_analyses(
        &self,
        conn: &Connection,
        query_text: &str,
        project_id: Option<&str>,
        analysis_type: Option<&str>,
        date_range: Option<DateRange>,
        top_k: usize,
        min_similarity: f32,
    ) -> Result<Vec<SimilarAnalysis>, String> {
        let start_time = std::time::Instant::now();
        info!("EmbeddingService: Searching for similar analyses - query length: {}, project: {:?}, type: {:?}, top_k: {}, min_similarity: {}",
              query_text.len(), project_id, analysis_type, top_k, min_similarity);

        // Generate embedding for query text
        let embed_start = std::time::Instant::now();
        let query_embedding = self.generate_embedding(query_text)?;
        let embed_duration = embed_start.elapsed();
        debug!("EmbeddingService: Query embedding generated in {:?}", embed_duration);

        // Get all candidate analyses from database
        let db_start = std::time::Instant::now();
        let candidates = get_all_analyses_with_embeddings(
            conn,
            project_id,
            analysis_type,
            date_range,
        )?;
        let db_duration = db_start.elapsed();
        info!("EmbeddingService: Retrieved {} candidate analyses from database in {:?}",
              candidates.len(), db_duration);

        // Prepare candidates for similarity search
        let candidate_embeddings: Vec<(i64, Vec<f32>)> = candidates
            .iter()
            .map(|a| (a.id, a.embedding.clone()))
            .collect();

        // Find similar embeddings
        let similarity_start = std::time::Instant::now();
        let similar_ids = find_similar(&query_embedding, &candidate_embeddings, top_k, min_similarity);
        let similarity_duration = similarity_start.elapsed();
        debug!("EmbeddingService: Similarity computation completed in {:?}, found {} matches above threshold",
               similarity_duration, similar_ids.len());

        // Convert to SimilarAnalysis results
        let results: Vec<SimilarAnalysis> = similar_ids
            .into_iter()
            .filter_map(|(id, similarity_score)| {
                candidates.iter().find(|c| c.id == id).map(|analysis| {
                    SimilarAnalysis {
                        id: analysis.id,
                        recording_id: analysis.recording_id.clone(),
                        project_id: analysis.project_id.clone(),
                        analysis_type: analysis.analysis_type.clone(),
                        analysis_content: analysis.analysis_content.clone(),
                        input_text: analysis.input_text.clone(),
                        timestamp: analysis.timestamp,
                        similarity_score,
                        confidence_score: analysis.confidence_score,
                    }
                })
            })
            .collect();

        let total_duration = start_time.elapsed();
        if !results.is_empty() {
            let score_summary: Vec<f32> = results.iter().map(|r| r.similarity_score).collect();
            let avg_score = score_summary.iter().sum::<f32>() / score_summary.len() as f32;
            let max_score = score_summary.iter().fold(f32::MIN, |a, &b| a.max(b));
            info!("EmbeddingService: Similarity search completed in {:?} - found {} results (avg score: {:.3}, max score: {:.3})",
                  total_duration, results.len(), avg_score, max_score);
        } else {
            info!("EmbeddingService: Similarity search completed in {:?} - no results found above threshold",
                  total_duration);
        }

        Ok(results)
    }

    /// Get historical context for an analysis
    ///
    /// Retrieves similar past analyses to provide context for new analysis
    ///
    /// # Arguments
    /// * `conn` - Database connection
    /// * `text` - Current text being analyzed
    /// * `project_id` - Project ID for scoping
    /// * `analysis_type` - Type of analysis
    /// * `context_size` - Number of historical examples to retrieve
    ///
    /// # Returns
    /// Formatted context string for prompt enhancement
    pub fn get_historical_context(
        &self,
        conn: &Connection,
        text: &str,
        project_id: &str,
        analysis_type: &str,
        context_size: usize,
    ) -> Result<String, String> {
        let start_time = std::time::Instant::now();
        info!("EmbeddingService: Getting historical context for {} analysis (project: {}, context_size: {})",
              analysis_type, project_id, context_size);

        let similar_analyses = self.find_similar_analyses(
            conn,
            text,
            Some(project_id),
            Some(analysis_type),
            None,
            context_size,
            0.7, // 0.7 similarity threshold for relevant context
        )?;

        if similar_analyses.is_empty() {
            info!("EmbeddingService: No historical context found (search took {:?})", start_time.elapsed());
            return Ok(String::new());
        }

        let mut context = String::from("## Historical Context\n\n");
        context.push_str(&format!(
            "Found {} similar past analyses:\n\n",
            similar_analyses.len()
        ));

        for (idx, analysis) in similar_analyses.iter().enumerate() {
            context.push_str(&format!(
                "### Example {} (similarity: {:.2}%)\n",
                idx + 1,
                analysis.similarity_score * 100.0
            ));
            context.push_str(&format!("**Input**: {}\n", analysis.input_text.chars().take(200).collect::<String>()));
            context.push_str(&format!("**Analysis**: {}\n\n", analysis.analysis_content.chars().take(300).collect::<String>()));
        }

        let total_duration = start_time.elapsed();
        info!("EmbeddingService: Historical context generated in {:?} - {} examples with {} chars total",
              total_duration, similar_analyses.len(), context.len());

        Ok(context)
    }

    /// Check if the embedding model is initialized
    pub fn is_initialized(&self) -> bool {
        self.model.lock().map(|m| m.is_some()).unwrap_or(false)
    }

    /// Get the embedding dimension
    #[allow(dead_code)]
    pub fn dimension(&self) -> usize {
        384 // all-MiniLM-L6-v2 dimension
    }

    /// Get the model name
    #[allow(dead_code)]
    pub fn model_name(&self) -> &str {
        "all-MiniLM-L6-v2"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_creation() {
        let service = EmbeddingService::new(
            PathBuf::from("model.onnx"),
            PathBuf::from("tokenizer.json"),
        );

        assert!(!service.is_initialized());
        assert_eq!(service.dimension(), 384);
        assert_eq!(service.model_name(), "all-MiniLM-L6-v2");
    }

    #[test]
    fn test_model_dimension() {
        let service = EmbeddingService::new(
            PathBuf::from("model.onnx"),
            PathBuf::from("tokenizer.json"),
        );

        assert_eq!(service.dimension(), 384);
    }
}
