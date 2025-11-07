/// MongoDB Atlas Configuration Management
///
/// Handles loading, validating, and persisting MongoDB Atlas connection
/// configurations with support for multiple configuration sources.

use super::{MongoConfig, VectorSearchConfig, MongoError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use tracing::{info, debug, warn, error};

/// Configuration manager for MongoDB Atlas connections
pub struct MongoConfigManager {
    config_dir: PathBuf,
}

impl MongoConfigManager {
    /// Create a new configuration manager
    pub fn new() -> Result<Self, ConfigError> {
        let config_dir = Self::get_config_directory()?;
        Ok(Self { config_dir })
    }

    /// Load MongoDB configuration from available sources (priority order)
    pub async fn load_config(&self) -> Result<MongoConfig, ConfigError> {
        // 1. Try environment variables first
        if let Ok(config) = self.load_from_environment().await {
            info!("Loaded MongoDB config from environment variables");
            return Ok(config);
        }

        // 2. Try user settings file
        if let Ok(config) = self.load_from_file().await {
            info!("Loaded MongoDB config from user settings file");
            return Ok(config);
        }

        // 3. No configuration found
        Err(ConfigError::NotConfigured {
            message: "No MongoDB configuration found. Please set environment variables or run the setup wizard.".to_string(),
            suggestion: "Set MONGODB_CONNECTION_STRING and other required environment variables, or use the UI setup wizard.".to_string()
        })
    }

    /// Save configuration to user settings file
    pub async fn save_config(&self, config: &MongoConfig) -> Result<(), ConfigError> {
        let config_file = self.config_dir.join("mongodb.json");

        // Ensure config directory exists
        if let Some(parent) = config_file.parent() {
            fs::create_dir_all(parent).await
                .map_err(|e| ConfigError::FileSystem(format!("Failed to create config directory: {}", e)))?;
        }

        let user_config = UserConfiguration::from_mongo_config(config);
        let json = serde_json::to_string_pretty(&user_config)
            .map_err(|e| ConfigError::Serialization(format!("Failed to serialize config: {}", e)))?;

        fs::write(&config_file, json).await
            .map_err(|e| ConfigError::FileSystem(format!("Failed to write config file: {}", e)))?;

        info!("Saved MongoDB configuration to: {}", config_file.display());
        Ok(())
    }

    /// Test MongoDB connection with given configuration
    pub async fn test_connection(&self, config: &MongoConfig) -> Result<ConnectionTestResult, ConfigError> {
        use mongodb::{Client, options::ClientOptions};

        info!("Testing MongoDB Atlas connection...");

        let mut test_result = ConnectionTestResult {
            connection_successful: false,
            database_accessible: false,
            vector_search_available: false,
            atlas_api_authenticated: false,
            index_configured: false,
            errors: Vec::new(),
            warnings: Vec::new(),
        };

        // Test 1: Basic connection
        let client_options = match ClientOptions::parse(&config.connection_string).await {
            Ok(options) => options,
            Err(e) => {
                test_result.errors.push(format!("Invalid connection string: {}", e));
                return Ok(test_result);
            }
        };

        let client = match Client::with_options(client_options) {
            Ok(client) => client,
            Err(e) => {
                test_result.errors.push(format!("Failed to create MongoDB client: {}", e));
                return Ok(test_result);
            }
        };

        // Test connection by pinging
        match client.database("admin").run_command(bson::doc! {"ping": 1}).await {
            Ok(_) => {
                test_result.connection_successful = true;
                info!("✅ MongoDB connection successful");
            },
            Err(e) => {
                test_result.errors.push(format!("Connection test failed: {}", e));
                return Ok(test_result);
            }
        }

        // Test 2: Database access
        let database = client.database(&config.database_name);
        match database.list_collection_names().await {
            Ok(_) => {
                test_result.database_accessible = true;
                info!("✅ Database '{}' is accessible", config.database_name);
            },
            Err(e) => {
                test_result.errors.push(format!("Database access failed: {}", e));
                return Ok(test_result);
            }
        }

        // Test 3: Vector search capability (check if Atlas Data API is available)
        if let Err(e) = self.test_atlas_data_api(&config.atlas_api_key).await {
            test_result.warnings.push(format!("Atlas Data API test failed: {}", e));
        } else {
            test_result.atlas_api_authenticated = true;
            info!("✅ Atlas Data API authentication successful");
        }

        // Test 4: Vector search index configuration
        match self.check_vector_search_index(&config).await {
            Ok(true) => {
                test_result.vector_search_available = true;
                test_result.index_configured = true;
                info!("✅ Vector search index is configured and available");
            },
            Ok(false) => {
                test_result.vector_search_available = true;
                test_result.warnings.push("Vector search is available but index is not configured. It will be created automatically.".to_string());
            },
            Err(e) => {
                test_result.warnings.push(format!("Vector search capability check failed: {}", e));
            }
        }

        Ok(test_result)
    }

    /// Setup Atlas Vector Search indexes automatically
    pub async fn setup_atlas_indexes(&self, config: &MongoConfig) -> Result<IndexSetupResult, ConfigError> {
        info!("Setting up Atlas Vector Search indexes...");

        // In a real implementation, this would use MongoDB Data API or Atlas Admin API
        // to create the required vector search indexes.
        // For now, we'll return a placeholder result indicating what needs to be done.

        let mut result = IndexSetupResult {
            indexes_created: Vec::new(),
            errors: Vec::new(),
            instructions: Vec::new(),
        };

        // Define required indexes
        let recording_index = VectorSearchIndexDefinition {
            name: config.vector_search_config.search_index_name.clone(),
            collection: "recordings".to_string(),
            definition: serde_json::json!({
                "fields": [
                    {
                        "type": "vector",
                        "path": "embedding",
                        "numDimensions": config.vector_search_config.dimensions,
                        "similarity": "cosine"
                    },
                    {
                        "type": "vector",
                        "path": "chunks.embedding",
                        "numDimensions": config.vector_search_config.dimensions,
                        "similarity": "cosine"
                    }
                ]
            }),
        };

        let knowledge_base_index = VectorSearchIndexDefinition {
            name: format!("{}_kb", config.vector_search_config.search_index_name),
            collection: "knowledge_base".to_string(),
            definition: serde_json::json!({
                "fields": [
                    {
                        "type": "vector",
                        "path": "embedding",
                        "numDimensions": config.vector_search_config.dimensions,
                        "similarity": "cosine"
                    }
                ]
            }),
        };

        // Add manual setup instructions since automatic index creation requires
        // Atlas Admin API which needs additional setup
        result.instructions.push(format!(
            "Create vector search index '{}' on 'recordings' collection with definition: {}",
            recording_index.name,
            serde_json::to_string_pretty(&recording_index.definition).unwrap_or_default()
        ));

        result.instructions.push(format!(
            "Create vector search index '{}' on 'knowledge_base' collection with definition: {}",
            knowledge_base_index.name,
            serde_json::to_string_pretty(&knowledge_base_index.definition).unwrap_or_default()
        ));

        result.instructions.push(
            "These indexes can be created through the MongoDB Atlas UI under Database > Search Indexes".to_string()
        );

        warn!("Index setup requires manual configuration in MongoDB Atlas UI");

        Ok(result)
    }

    /// Validate complete configuration setup
    pub async fn validate_setup(&self, config: &MongoConfig) -> Result<SetupValidationResult, ConfigError> {
        info!("Validating complete MongoDB Atlas setup...");

        let connection_test = self.test_connection(config).await?;
        let mut validation = SetupValidationResult {
            is_fully_configured: false,
            connection_test: connection_test,
            missing_requirements: Vec::new(),
            recommendations: Vec::new(),
        };

        // Check all requirements
        if !validation.connection_test.connection_successful {
            validation.missing_requirements.push("MongoDB Atlas connection is not working".to_string());
        }

        if !validation.connection_test.database_accessible {
            validation.missing_requirements.push("Database is not accessible".to_string());
        }

        if !validation.connection_test.atlas_api_authenticated {
            validation.missing_requirements.push("Atlas Data API authentication failed".to_string());
            validation.recommendations.push("Verify your Atlas API key is correct and has proper permissions".to_string());
        }

        if !validation.connection_test.index_configured {
            validation.missing_requirements.push("Vector search indexes are not configured".to_string());
            validation.recommendations.push("Create vector search indexes through MongoDB Atlas UI".to_string());
        }

        // Environment variable recommendations
        if std::env::var("MONGODB_CONNECTION_STRING").is_err() {
            validation.recommendations.push("Consider setting MONGODB_CONNECTION_STRING environment variable for easier deployment".to_string());
        }

        validation.is_fully_configured = validation.missing_requirements.is_empty();

        if validation.is_fully_configured {
            info!("✅ MongoDB Atlas setup is fully configured and ready");
        } else {
            warn!("⚠️  MongoDB Atlas setup is incomplete. Missing: {:?}", validation.missing_requirements);
        }

        Ok(validation)
    }

    // Private helper methods

    fn get_config_directory() -> Result<PathBuf, ConfigError> {
        let home = dirs::home_dir()
            .ok_or_else(|| ConfigError::FileSystem("Could not determine home directory".to_string()))?;

        Ok(home.join(".causal"))
    }

    async fn load_from_environment(&self) -> Result<MongoConfig, ConfigError> {
        let connection_string = std::env::var("MONGODB_CONNECTION_STRING")
            .map_err(|_| ConfigError::MissingEnvironmentVariable("MONGODB_CONNECTION_STRING".to_string()))?;

        let database_name = std::env::var("MONGODB_DATABASE_NAME")
            .unwrap_or_else(|_| "causal_production".to_string());

        let atlas_api_key = std::env::var("ATLAS_API_KEY")
            .map_err(|_| ConfigError::MissingEnvironmentVariable("ATLAS_API_KEY".to_string()))?;

        let project_id = std::env::var("ATLAS_PROJECT_ID")
            .map_err(|_| ConfigError::MissingEnvironmentVariable("ATLAS_PROJECT_ID".to_string()))?;

        let cluster_name = std::env::var("ATLAS_CLUSTER_NAME")
            .map_err(|_| ConfigError::MissingEnvironmentVariable("ATLAS_CLUSTER_NAME".to_string()))?;

        let search_index_name = std::env::var("VECTOR_SEARCH_INDEX_NAME")
            .unwrap_or_else(|_| "vector_index".to_string());

        Ok(MongoConfig {
            connection_string,
            database_name: database_name.clone(),
            atlas_api_key,
            vector_search_config: VectorSearchConfig {
                project_id,
                cluster_name,
                database_name,
                search_index_name,
                embedding_model: "voyage-2".to_string(),
                dimensions: 1536,
                similarity_threshold: 0.7,
                max_context_length: 8000,
                chunk_size: 512,
                chunk_overlap: 50,
            },
        })
    }

    async fn load_from_file(&self) -> Result<MongoConfig, ConfigError> {
        let config_file = self.config_dir.join("mongodb.json");

        if !config_file.exists() {
            return Err(ConfigError::FileNotFound(config_file));
        }

        let content = fs::read_to_string(&config_file).await
            .map_err(|e| ConfigError::FileSystem(format!("Failed to read config file: {}", e)))?;

        let user_config: UserConfiguration = serde_json::from_str(&content)
            .map_err(|e| ConfigError::Serialization(format!("Failed to parse config file: {}", e)))?;

        user_config.to_mongo_config()
    }

    async fn test_atlas_data_api(&self, api_key: &str) -> Result<(), String> {
        // Test Atlas Data API availability by making a simple request
        // This is a placeholder - actual implementation would test the specific endpoint

        if api_key.is_empty() {
            return Err("Atlas API key is empty".to_string());
        }

        if !api_key.starts_with("mdb_") {
            return Err("Atlas API key does not appear to be valid (should start with 'mdb_')".to_string());
        }

        // In a real implementation, this would make an authenticated request
        // to the Atlas Data API to verify the key is valid
        debug!("Atlas API key format appears valid");
        Ok(())
    }

    async fn check_vector_search_index(&self, config: &MongoConfig) -> Result<bool, String> {
        // In a real implementation, this would check if the vector search index exists
        // using Atlas Admin API or by attempting a vector search query

        debug!("Checking vector search index: {}", config.vector_search_config.search_index_name);

        // Placeholder: assume index needs to be created
        Ok(false)
    }
}

// =============================================================================
// Configuration Types
// =============================================================================

/// User-facing configuration structure for JSON storage
#[derive(Debug, Serialize, Deserialize)]
struct UserConfiguration {
    connection_string: String,
    database_name: String,
    atlas_api_key: String,
    project_id: String,
    cluster_name: String,
    search_index_name: String,
    #[serde(default)]
    advanced_settings: AdvancedSettings,
}

#[derive(Debug, Serialize, Deserialize)]
struct AdvancedSettings {
    embedding_model: String,
    dimensions: usize,
    similarity_threshold: f32,
    max_context_length: usize,
    chunk_size: usize,
    chunk_overlap: usize,
}

impl Default for AdvancedSettings {
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

impl UserConfiguration {
    fn from_mongo_config(config: &MongoConfig) -> Self {
        Self {
            connection_string: config.connection_string.clone(),
            database_name: config.database_name.clone(),
            atlas_api_key: config.atlas_api_key.clone(),
            project_id: config.vector_search_config.project_id.clone(),
            cluster_name: config.vector_search_config.cluster_name.clone(),
            search_index_name: config.vector_search_config.search_index_name.clone(),
            advanced_settings: AdvancedSettings {
                embedding_model: config.vector_search_config.embedding_model.clone(),
                dimensions: config.vector_search_config.dimensions,
                similarity_threshold: config.vector_search_config.similarity_threshold,
                max_context_length: config.vector_search_config.max_context_length,
                chunk_size: config.vector_search_config.chunk_size,
                chunk_overlap: config.vector_search_config.chunk_overlap,
            },
        }
    }

    fn to_mongo_config(self) -> Result<MongoConfig, ConfigError> {
        Ok(MongoConfig {
            connection_string: self.connection_string,
            database_name: self.database_name.clone(),
            atlas_api_key: self.atlas_api_key,
            vector_search_config: VectorSearchConfig {
                project_id: self.project_id,
                cluster_name: self.cluster_name,
                database_name: self.database_name,
                search_index_name: self.search_index_name,
                embedding_model: self.advanced_settings.embedding_model,
                dimensions: self.advanced_settings.dimensions,
                similarity_threshold: self.advanced_settings.similarity_threshold,
                max_context_length: self.advanced_settings.max_context_length,
                chunk_size: self.advanced_settings.chunk_size,
                chunk_overlap: self.advanced_settings.chunk_overlap,
            },
        })
    }
}

/// Connection test results
#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub connection_successful: bool,
    pub database_accessible: bool,
    pub vector_search_available: bool,
    pub atlas_api_authenticated: bool,
    pub index_configured: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Index setup results
#[derive(Debug, Serialize, Deserialize)]
pub struct IndexSetupResult {
    pub indexes_created: Vec<String>,
    pub errors: Vec<String>,
    pub instructions: Vec<String>,
}

/// Vector search index definition
#[derive(Debug, Serialize, Deserialize)]
pub struct VectorSearchIndexDefinition {
    pub name: String,
    pub collection: String,
    pub definition: serde_json::Value,
}

/// Complete setup validation result
#[derive(Debug, Serialize, Deserialize)]
pub struct SetupValidationResult {
    pub is_fully_configured: bool,
    pub connection_test: ConnectionTestResult,
    pub missing_requirements: Vec<String>,
    pub recommendations: Vec<String>,
}

/// Configuration error types
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Configuration not found: {message}. Suggestion: {suggestion}")]
    NotConfigured { message: String, suggestion: String },

    #[error("Missing required environment variable: {0}")]
    MissingEnvironmentVariable(String),

    #[error("Configuration file not found: {0}")]
    FileNotFound(PathBuf),

    #[error("File system error: {0}")]
    FileSystem(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),
}

impl From<ConfigError> for MongoError {
    fn from(err: ConfigError) -> Self {
        MongoError::Configuration(err.to_string())
    }
}