/// Local Vector Embeddings Module
///
/// This module provides local embedding generation using ONNX Runtime for semantic
/// search and analysis context retrieval. All processing is done locally without
/// external API dependencies.
///
/// Key Features:
/// - Local embedding generation using all-MiniLM-L6-v2 model
/// - Vector similarity search (cosine similarity)
/// - Efficient batch processing for bulk operations
/// - Integration with SQLite for persistent storage

pub mod commands;
pub mod model;
pub mod service;
pub mod similarity;
pub mod storage;

pub use commands::*;
