/// ONNX-based embedding model for local inference
///
/// Uses all-MiniLM-L6-v2 sentence-transformers model to generate
/// 384-dimensional embeddings for semantic search and similarity matching.

use ndarray::CowArray;
use ort::{Environment, ExecutionProvider, GraphOptimizationLevel, Session, SessionBuilder, Value, execution_providers::CPUExecutionProviderOptions, tensor::OrtOwnedTensor};
use std::path::Path;
use std::sync::Arc;
use tokenizers::Tokenizer;
use tracing::{debug, info, warn};

const MAX_SEQUENCE_LENGTH: usize = 256;
const EMBEDDING_DIM: usize = 384;

/// Embedding model for generating vector representations of text
pub struct EmbeddingModel {
    session: Session,
    tokenizer: Tokenizer,
    model_name: String,
}

impl EmbeddingModel {
    /// Initialize the embedding model from a local ONNX file
    ///
    /// # Arguments
    /// * `model_path` - Path to the ONNX model file
    /// * `tokenizer_path` - Path to the tokenizer JSON file
    ///
    /// # Returns
    /// A new EmbeddingModel instance ready for inference
    pub fn new(model_path: impl AsRef<Path>, tokenizer_path: impl AsRef<Path>) -> Result<Self, String> {
        info!("Initializing embedding model from {:?}", model_path.as_ref());

        // Initialize ONNX Runtime environment
        let environment = Arc::new(
            Environment::builder()
                .with_name("embeddings")
                .with_execution_providers([ExecutionProvider::CPU(CPUExecutionProviderOptions::default())])
                .build()
                .map_err(|e| format!("Failed to create ONNX environment: {}", e))?
        );

        // Create session with optimizations
        let session = SessionBuilder::new(&environment)
            .map_err(|e| format!("Failed to create session builder: {}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| format!("Failed to set optimization level: {}", e))?
            .with_intra_threads(4)
            .map_err(|e| format!("Failed to set thread count: {}", e))?
            .with_model_from_file(model_path.as_ref())
            .map_err(|e| format!("Failed to load model: {}", e))?;

        // Load tokenizer
        let tokenizer = Tokenizer::from_file(tokenizer_path.as_ref())
            .map_err(|e| format!("Failed to load tokenizer: {}", e))?;

        info!("Embedding model initialized successfully");

        Ok(Self {
            session,
            tokenizer,
            model_name: "all-MiniLM-L6-v2".to_string(),
        })
    }

    /// Generate embedding vector for a single text
    ///
    /// # Arguments
    /// * `text` - Input text to embed
    ///
    /// # Returns
    /// A 384-dimensional embedding vector
    pub fn encode(&self, text: &str) -> Result<Vec<f32>, String> {
        debug!("Generating embedding for text of length {}", text.len());

        // Tokenize input
        let encoding = self.tokenizer
            .encode(text, false)
            .map_err(|e| format!("Tokenization failed: {}", e))?;

        let mut input_ids = encoding.get_ids().to_vec();
        let mut attention_mask = encoding.get_attention_mask().to_vec();

        // Truncate or pad to max sequence length
        if input_ids.len() > MAX_SEQUENCE_LENGTH {
            input_ids.truncate(MAX_SEQUENCE_LENGTH);
            attention_mask.truncate(MAX_SEQUENCE_LENGTH);
            warn!("Text truncated to {} tokens", MAX_SEQUENCE_LENGTH);
        } else {
            let padding_len = MAX_SEQUENCE_LENGTH - input_ids.len();
            input_ids.extend(vec![0; padding_len]);
            attention_mask.extend(vec![0; padding_len]);
        }

        // Prepare input tensors using CowArray
        let input_ids_vec: Vec<i64> = input_ids.iter().map(|&x| x as i64).collect();
        let attention_mask_vec: Vec<i64> = attention_mask.iter().map(|&x| x as i64).collect();

        // Create CowArray tensors
        let input_ids_cow = CowArray::from(
            ndarray::Array::from_shape_vec((1, MAX_SEQUENCE_LENGTH), input_ids_vec)
                .map_err(|e| format!("Failed to create input_ids array: {}", e))?
        ).into_dyn();

        let attention_mask_cow = CowArray::from(
            ndarray::Array::from_shape_vec((1, MAX_SEQUENCE_LENGTH), attention_mask_vec)
                .map_err(|e| format!("Failed to create attention_mask array: {}", e))?
        ).into_dyn();

        let input_ids_tensor = Value::from_array(self.session.allocator(), &input_ids_cow)
            .map_err(|e| format!("Failed to create input_ids tensor: {}", e))?;
        let attention_mask_tensor = Value::from_array(self.session.allocator(), &attention_mask_cow)
            .map_err(|e| format!("Failed to create attention_mask tensor: {}", e))?;

        let inputs = vec![input_ids_tensor, attention_mask_tensor];

        let outputs = self.session
            .run(inputs)
            .map_err(|e| format!("Inference failed: {}", e))?;

        // Extract embeddings from output
        let output_tensor = outputs[0]
            .try_extract::<f32>()
            .map_err(|e| format!("Failed to extract output tensor: {}", e))?;

        // Mean pooling over sequence dimension
        let embedding = self.mean_pooling(&output_tensor, &attention_mask)?;

        // Normalize embedding
        let normalized = self.normalize_embedding(&embedding);

        debug!("Generated embedding with dimension {}", normalized.len());

        Ok(normalized)
    }

    /// Generate embeddings for multiple texts in batch
    ///
    /// # Arguments
    /// * `texts` - Vector of texts to embed
    ///
    /// # Returns
    /// Vector of embedding vectors
    pub fn encode_batch(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, String> {
        texts.iter()
            .map(|text| self.encode(text))
            .collect()
    }

    /// Mean pooling across token embeddings, weighted by attention mask
    fn mean_pooling(&self, embeddings: &OrtOwnedTensor<f32, ndarray::Dim<ndarray::IxDynImpl>>, attention_mask: &[u32]) -> Result<Vec<f32>, String> {
        let mut pooled = vec![0.0; EMBEDDING_DIM];
        let mut sum_mask = 0.0;

        // Access the ndarray view from the tensor
        let tensor_view = embeddings.view();
        let shape = tensor_view.shape();
        if shape.len() != 3 {
            return Err("Expected 3D tensor for embeddings".to_string());
        }

        for (i, &mask_val) in attention_mask.iter().enumerate() {
            if i >= MAX_SEQUENCE_LENGTH || i >= shape[1] {
                break;
            }
            let weight = mask_val as f32;
            sum_mask += weight;

            for j in 0..EMBEDDING_DIM {
                if j < shape[2] {
                    let val = tensor_view[[0, i, j]];
                    pooled[j] += val * weight;
                }
            }
        }

        // Avoid division by zero
        if sum_mask > 0.0 {
            for val in pooled.iter_mut() {
                *val /= sum_mask;
            }
        }

        Ok(pooled)
    }

    /// Normalize embedding to unit length (L2 normalization)
    fn normalize_embedding(&self, embedding: &[f32]) -> Vec<f32> {
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm > 0.0 {
            embedding.iter().map(|x| x / norm).collect()
        } else {
            embedding.to_vec()
        }
    }

    /// Get the model name
    pub fn model_name(&self) -> &str {
        &self.model_name
    }

    /// Get the embedding dimension
    pub fn dimension(&self) -> usize {
        EMBEDDING_DIM
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests require the model files to be present
    // In production, we'll bundle them with the application

    #[test]
    fn test_embedding_dimension() {
        assert_eq!(EMBEDDING_DIM, 384);
    }

    #[test]
    fn test_max_sequence_length() {
        assert_eq!(MAX_SEQUENCE_LENGTH, 256);
    }
}
