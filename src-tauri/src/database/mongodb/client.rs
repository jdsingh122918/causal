/// MongoDB client connection and database management
///
/// Provides connection management and database access for MongoDB Atlas
/// with proper error handling and connection pooling.

use super::{MongoConfig, MongoError, MongoResult};
use mongodb::{Client, Database, Collection, options::ClientOptions};
use std::time::Duration;
use tracing::{info, debug, error};

/// MongoDB database wrapper with connection management
#[derive(Clone)]
pub struct MongoDatabase {
    pub client: Client,
    pub database: Database,
    pub config: MongoConfig,
}

impl MongoDatabase {
    /// Create a new MongoDB connection
    pub async fn new(config: MongoConfig) -> MongoResult<Self> {
        info!("Connecting to MongoDB Atlas at database: {}", config.database_name);

        // Parse connection string and set options
        let mut client_options = ClientOptions::parse(&config.connection_string).await?;

        // Configure connection pool and timeouts
        client_options.max_pool_size = Some(10);
        client_options.min_pool_size = Some(2);
        client_options.max_idle_time = Some(Duration::from_secs(300)); // 5 minutes
        client_options.server_selection_timeout = Some(Duration::from_secs(30));

        // Create client and get database
        let client = Client::with_options(client_options)?;
        let database = client.database(&config.database_name);

        // Test connection
        Self::test_connection(&database).await?;

        info!("Successfully connected to MongoDB Atlas");

        Ok(Self {
            client,
            database,
            config,
        })
    }

    /// Test database connectivity
    async fn test_connection(database: &Database) -> MongoResult<()> {
        use bson::doc;

        debug!("Testing MongoDB connection...");

        database
            .run_command(doc! {"ping": 1})
            .await
            .map_err(|e| {
                error!("Failed to ping MongoDB: {}", e);
                MongoError::Connection(e)
            })?;

        debug!("MongoDB connection test successful");
        Ok(())
    }

    /// Get projects collection
    pub fn projects(&self) -> Collection<crate::database::mongodb::models::MongoProject> {
        self.database.collection("projects")
    }

    /// Get recordings collection
    pub fn recordings(&self) -> Collection<crate::database::mongodb::models::MongoRecording> {
        self.database.collection("recordings")
    }

    /// Get analysis results collection
    pub fn analysis_results(&self) -> Collection<crate::database::mongodb::models::MongoAnalysisResult> {
        self.database.collection("analysis_results")
    }

    /// Get knowledge base collection
    pub fn knowledge_base(&self) -> Collection<crate::database::mongodb::models::MongoKnowledgeBaseEntry> {
        self.database.collection("rag_knowledge_base")
    }

    /// Get secure settings collection
    pub fn secure_settings(&self) -> Collection<crate::database::mongodb::models::MongoSecureSetting> {
        self.database.collection("secure_settings")
    }

    /// Initialize database indexes for optimal performance
    pub async fn initialize_indexes(&self) -> MongoResult<()> {
        info!("Initializing MongoDB indexes...");

        // Projects indexes
        self.create_projects_indexes().await?;

        // Recordings indexes
        self.create_recordings_indexes().await?;

        // Analysis results indexes
        self.create_analysis_indexes().await?;

        // Knowledge base indexes
        self.create_knowledge_base_indexes().await?;

        info!("Successfully initialized all MongoDB indexes");
        Ok(())
    }

    async fn create_projects_indexes(&self) -> MongoResult<()> {
        use mongodb::IndexModel;
        use bson::doc;

        let collection = self.projects();

        let indexes = vec![
            IndexModel::builder()
                .keys(doc! {"name": 1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .unique(true)
                        .name("unique_project_name".to_string())
                        .build()
                )
                .build(),
            IndexModel::builder()
                .keys(doc! {"created_at": -1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("project_created_at".to_string())
                        .build()
                )
                .build(),
        ];

        collection.create_indexes(indexes).await?;
        debug!("Created projects indexes");
        Ok(())
    }

    async fn create_recordings_indexes(&self) -> MongoResult<()> {
        use mongodb::IndexModel;
        use bson::doc;

        let collection = self.recordings();

        let indexes = vec![
            IndexModel::builder()
                .keys(doc! {"project_id": 1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("recording_project_id".to_string())
                        .build()
                )
                .build(),
            IndexModel::builder()
                .keys(doc! {"project_id": 1, "created_at": -1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("recording_project_date".to_string())
                        .build()
                )
                .build(),
            IndexModel::builder()
                .keys(doc! {"status": 1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("recording_status".to_string())
                        .build()
                )
                .build(),
            IndexModel::builder()
                .keys(doc! {"metadata.topics": 1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("recording_topics".to_string())
                        .build()
                )
                .build(),
        ];

        collection.create_indexes(indexes).await?;
        debug!("Created recordings indexes");
        Ok(())
    }

    async fn create_analysis_indexes(&self) -> MongoResult<()> {
        use mongodb::IndexModel;
        use bson::doc;

        let collection = self.analysis_results();

        let indexes = vec![
            IndexModel::builder()
                .keys(doc! {"project_id": 1, "analysis_type": 1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("analysis_project_type".to_string())
                        .build()
                )
                .build(),
            IndexModel::builder()
                .keys(doc! {"recording_id": 1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("analysis_recording".to_string())
                        .build()
                )
                .build(),
            IndexModel::builder()
                .keys(doc! {"timestamp": -1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("analysis_timestamp".to_string())
                        .build()
                )
                .build(),
        ];

        collection.create_indexes(indexes).await?;
        debug!("Created analysis results indexes");
        Ok(())
    }

    async fn create_knowledge_base_indexes(&self) -> MongoResult<()> {
        use mongodb::IndexModel;
        use bson::doc;

        let collection = self.knowledge_base();

        let indexes = vec![
            IndexModel::builder()
                .keys(doc! {"project_id": 1, "content_type": 1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("knowledge_project_type".to_string())
                        .build()
                )
                .build(),
            IndexModel::builder()
                .keys(doc! {"topics": 1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("knowledge_topics".to_string())
                        .build()
                )
                .build(),
            IndexModel::builder()
                .keys(doc! {"created_at": -1})
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("knowledge_created_at".to_string())
                        .build()
                )
                .build(),
        ];

        collection.create_indexes(indexes).await?;
        debug!("Created knowledge base indexes");
        Ok(())
    }

    /// Get database statistics
    pub async fn get_stats(&self) -> MongoResult<DatabaseStats> {
        use bson::doc;

        let stats_doc = self.database
            .run_command(doc! {"dbStats": 1})
            .await?;

        let projects_count = self.projects().estimated_document_count().await? as u32;
        let recordings_count = self.recordings().estimated_document_count().await? as u32;
        let analysis_count = self.analysis_results().estimated_document_count().await? as u32;
        let knowledge_count = self.knowledge_base().estimated_document_count().await? as u32;

        Ok(DatabaseStats {
            projects_count,
            recordings_count,
            analysis_count,
            knowledge_count,
            database_size: stats_doc.get_f64("dataSize").unwrap_or(0.0) as u64,
            index_size: stats_doc.get_f64("indexSize").unwrap_or(0.0) as u64,
        })
    }
}

/// Database statistics
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct DatabaseStats {
    pub projects_count: u32,
    pub recordings_count: u32,
    pub analysis_count: u32,
    pub knowledge_count: u32,
    pub database_size: u64,
    pub index_size: u64,
}