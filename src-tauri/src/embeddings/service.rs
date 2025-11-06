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
use tracing::{debug, info};

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
        // Ensure model is initialized
        if self.model.lock().map_err(|e| format!("Lock error: {}", e))?.is_none() {
            self.initialize()?;
        }

        let model_lock = self.model.lock()
            .map_err(|e| format!("Failed to acquire model lock: {}", e))?;

        let model = model_lock.as_ref()
            .ok_or("Embedding model not initialized")?;

        model.encode(text)
    }

    /// Generate embeddings for multiple texts
    ///
    /// # Arguments
    /// * `texts` - Vector of texts to embed
    ///
    /// # Returns
    /// Vector of embedding vectors
    pub fn generate_embeddings(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, String> {
        // Ensure model is initialized
        if self.model.lock().map_err(|e| format!("Lock error: {}", e))?.is_none() {
            self.initialize()?;
        }

        let model_lock = self.model.lock()
            .map_err(|e| format!("Failed to acquire model lock: {}", e))?;

        let model = model_lock.as_ref()
            .ok_or("Embedding model not initialized")?;

        model.encode_batch(texts)
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
        // Generate embedding for the input text
        let embedding = self.generate_embedding(input_text)?;

        // Store in database
        store_analysis(
            conn,
            recording_id,
            project_id,
            analysis_type,
            analysis_content,
            input_text,
            &embedding,
            confidence_score,
            processing_time_ms,
        )
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
        // Generate embedding for query text
        let query_embedding = self.generate_embedding(query_text)?;

        // Get all candidate analyses from database
        let candidates = get_all_analyses_with_embeddings(
            conn,
            project_id,
            analysis_type,
            date_range,
        )?;

        // Prepare candidates for similarity search
        let candidate_embeddings: Vec<(i64, Vec<f32>)> = candidates
            .iter()
            .map(|a| (a.id, a.embedding.clone()))
            .collect();

        // Find similar embeddings
        let similar_ids = find_similar(&query_embedding, &candidate_embeddings, top_k, min_similarity);

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

        Ok(context)
    }

    /// Check if the embedding model is initialized
    pub fn is_initialized(&self) -> bool {
        self.model.lock().map(|m| m.is_some()).unwrap_or(false)
    }

    /// Get the embedding dimension
    pub fn dimension(&self) -> usize {
        384 // all-MiniLM-L6-v2 dimension
    }

    /// Get the model name
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
