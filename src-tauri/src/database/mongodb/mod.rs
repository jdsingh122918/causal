/// MongoDB integration module for Causal
///
/// This module provides MongoDB Atlas integration with vector search capabilities
/// to replace the existing SQLite database with a cloud-native RAG-enabled solution.

pub mod client;
pub mod collections;
pub mod models;
pub mod migrations;
pub mod vector_search;

// Re-export key types for easier access
pub use client::MongoDatabase;
pub use models::*;
pub use collections::{ProjectCollection, RecordingCollection, KnowledgeBaseCollection};
pub use vector_search::AtlasVectorSearch;

use std::collections::HashMap;

/// Configuration for MongoDB connection and Atlas features
#[derive(Debug, Clone)]
pub struct MongoConfig {
    pub connection_string: String,
    pub database_name: String,
    pub atlas_api_key: String,
    pub vector_search_config: VectorSearchConfig,
}

/// Vector search configuration for Atlas
#[derive(Debug, Clone)]
pub struct VectorSearchConfig {
    pub embedding_model: String,     // "voyage-2" or "voyage-code-2"
    pub dimensions: usize,           // 1536 for VoyageAI
    pub similarity_threshold: f32,   // 0.7
    pub max_context_length: usize,   // 8000 tokens
    pub chunk_size: usize,           // 512 tokens
    pub chunk_overlap: usize,        // 50 tokens
}

impl Default for VectorSearchConfig {
    fn default() -> Self {
        Self {
            embedding_model: "voyage-2".to_string(),
            dimensions: 1536,
            similarity_threshold: 0.7,
            max_context_length: 8000,
            chunk_size: 512,
            chunk_overlap: 50,
        }
    }
}

/// Error types for MongoDB operations
#[derive(Debug, thiserror::Error)]
pub enum MongoError {
    #[error("Connection error: {0}")]
    Connection(#[from] mongodb::error::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] bson::ser::Error),

    #[error("Deserialization error: {0}")]
    Deserialization(#[from] bson::de::Error),

    #[error("Vector search error: {0}")]
    VectorSearch(String),

    #[error("Migration error: {0}")]
    Migration(String),

    #[error("Configuration error: {0}")]
    Configuration(String),
}

pub type MongoResult<T> = Result<T, MongoError>;

/// Context configuration for RAG queries
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ContextConfig {
    pub max_results: usize,
    pub similarity_threshold: f32,
    pub include_metadata: bool,
    pub time_range_days: Option<u32>,
    pub content_types: Option<Vec<String>>,
}

impl Default for ContextConfig {
    fn default() -> Self {
        Self {
            max_results: 5,
            similarity_threshold: 0.7,
            include_metadata: true,
            time_range_days: Some(90), // 3 months
            content_types: None,
        }
    }
}

/// Search filters for queries
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchFilters {
    pub project_ids: Option<Vec<String>>,
    pub content_types: Option<Vec<String>>,
    pub date_range: Option<DateRange>,
    pub topics: Option<Vec<String>>,
    pub min_confidence: Option<f32>,
}

/// Date range for filtering
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DateRange {
    pub start: chrono::DateTime<chrono::Utc>,
    pub end: chrono::DateTime<chrono::Utc>,
}