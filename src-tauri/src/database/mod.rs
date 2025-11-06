//! # Database Layer for Project and Recording Management
//!
//! This module provides a SQLite-based persistence layer for managing projects and recordings
//! in the Causal application. It features optimized database connections with WAL mode,
//! proper transaction handling, and comprehensive CRUD operations.
//!
//! ## Key Components
//!
//! - [`Database`] - Main database interface with connection pooling
//! - [`Recording`] - Recording data model with metadata
//! - [`models`] - Data models and structures
//! - [`commands`] - Tauri command handlers for database operations
//!
//! ## Database Features
//!
//! - **WAL Mode**: Write-Ahead Logging for better concurrency
//! - **Performance Optimized**: 64MB cache, memory temp store
//! - **Foreign Key Support**: Proper referential integrity
//! - **Index Optimization**: Strategic indexing for common queries
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

pub use commands::*;
pub use models::{Project, Recording, RecordingMetadata};
pub use secure_settings_commands::*;
pub use store::Database;
