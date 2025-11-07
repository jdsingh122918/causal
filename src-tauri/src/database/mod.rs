//! # Database Layer for Project and Recording Management
//!
//! This module provides database persistence layers for managing projects and recordings
//! in the Causal application. Supports both SQLite (legacy) and MongoDB (with RAG capabilities).
//!
//! ## Key Components
//!
//! ### SQLite (Legacy)
//! - [`Database`] - SQLite database interface with connection pooling
//! - WAL Mode for better concurrency, optimized for local storage
//!
//! ### MongoDB (New)
//! - [`mongodb::MongoDatabase`] - MongoDB Atlas with vector search
//! - RAG capabilities with Atlas VoyageAI embeddings
//! - Cloud-native scaling and collaboration features
//!
//! ## Migration Path
//!
//! The application is transitioning from SQLite to MongoDB for enhanced RAG capabilities:
//! 1. SQLite continues to work for existing installations
//! 2. MongoDB provides vector search and semantic capabilities
//! 3. Migration utilities help transition existing data
//!
//! ## Example Usage
//!
//! ```rust,no_run
//! use causal_lib::database::{Database, models::Project};
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! let db = Database::new()?;
//!
//! // Create a new project
//! let project = Project::new(
//!     "My Project".to_string(),
//!     "A test project".to_string()
//! );
//! let created = db.create_project(project).await?;
//!
//! // List all projects
//! let projects = db.list_projects().await?;
//! println!("Found {} projects", projects.len());
//! # Ok(())
//! # }
//! ```

pub mod commands;
pub mod models;
pub mod secure_settings_commands;
mod serde_helpers;
pub mod store;

// MongoDB integration module
pub mod mongodb;

pub use commands::*;
pub use models::{Project, Recording, RecordingMetadata};
pub use secure_settings_commands::*;
pub use store::Database;
