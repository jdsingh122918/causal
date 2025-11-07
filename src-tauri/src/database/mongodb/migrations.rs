/// SQLite to MongoDB migration utilities
///
/// Handles the migration of data from SQLite to MongoDB with proper
/// data transformation, embedding generation, and validation.

use super::{MongoDatabase, MongoError, MongoResult, AtlasVectorSearch};
use super::models::*;
use crate::database::{Database as SqliteDatabase, models as sqlite_models};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{info, debug, warn, error};
use uuid::Uuid;

/// Migration service for SQLite to MongoDB
pub struct MigrationService {
    sqlite_db: SqliteDatabase,
    mongo_db: MongoDatabase,
    vector_search: AtlasVectorSearch,
}

impl MigrationService {
    pub fn new(
        sqlite_db: SqliteDatabase,
        mongo_db: MongoDatabase,
        atlas_api_key: String,
    ) -> Self {
        let vector_search = AtlasVectorSearch::new(mongo_db.clone(), atlas_api_key);

        Self {
            sqlite_db,
            mongo_db,
            vector_search,
        }
    }

    /// Perform complete migration from SQLite to MongoDB
    pub async fn perform_full_migration(&self) -> MongoResult<MigrationReport> {
        info!("Starting full migration from SQLite to MongoDB");

        let start_time = std::time::Instant::now();
        let mut report = MigrationReport::new();

        // Phase 1: Migrate projects
        info!("Phase 1: Migrating projects");
        let projects_result = self.migrate_projects().await?;
        report.projects_migrated = projects_result.migrated_count;
        report.projects_failed = projects_result.failed_count;

        // Phase 2: Migrate recordings with embeddings
        info!("Phase 2: Migrating recordings with embedding generation");
        let recordings_result = self.migrate_recordings().await?;
        report.recordings_migrated = recordings_result.migrated_count;
        report.recordings_failed = recordings_result.failed_count;
        report.embeddings_generated = recordings_result.embeddings_generated;

        // Phase 3: Migrate analysis results
        info!("Phase 3: Migrating analysis results");
        let analysis_result = self.migrate_analysis_results().await?;
        report.analysis_migrated = analysis_result.migrated_count;
        report.analysis_failed = analysis_result.failed_count;

        // Phase 4: Generate knowledge base
        info!("Phase 4: Generating knowledge base entries");
        let knowledge_result = self.generate_knowledge_base().await?;
        report.knowledge_entries_created = knowledge_result.created_count;

        // Phase 5: Initialize indexes
        info!("Phase 5: Initializing MongoDB indexes");
        self.mongo_db.initialize_indexes().await?;

        report.total_time = start_time.elapsed();
        report.success = true;

        info!("Migration completed successfully in {:?}", report.total_time);
        info!("Migration summary: {}", report.summary());

        Ok(report)
    }

    /// Migrate projects from SQLite to MongoDB
    async fn migrate_projects(&self) -> MongoResult<MigrationPhaseResult> {
        let mut result = MigrationPhaseResult::new();

        // Get all projects from SQLite
        let sqlite_projects = self.sqlite_db.list_projects()
            .await
            .map_err(|e| MongoError::Migration(format!("Failed to load SQLite projects: {}", e)))?;

        let project_collection = super::collections::ProjectCollection::new(&self.mongo_db);

        for sqlite_project in sqlite_projects {
            match self.migrate_single_project(&project_collection, sqlite_project).await {
                Ok(_) => {
                    result.migrated_count += 1;
                    debug!("Successfully migrated project: {}", result.migrated_count);
                }
                Err(e) => {
                    result.failed_count += 1;
                    error!("Failed to migrate project: {}", e);
                    result.errors.push(format!("Project migration error: {}", e));
                }
            }
        }

        info!("Projects migration complete: {} migrated, {} failed",
              result.migrated_count, result.failed_count);

        Ok(result)
    }

    async fn migrate_single_project(
        &self,
        collection: &super::collections::ProjectCollection,
        sqlite_project: sqlite_models::Project,
    ) -> MongoResult<()> {
        let mongo_project = MongoProject::from(sqlite_project);

        collection.create(mongo_project).await?;
        Ok(())
    }

    /// Migrate recordings with embedding generation
    async fn migrate_recordings(&self) -> MongoResult<MigrationPhaseResult> {
        let mut result = MigrationPhaseResult::new();

        // Get all recordings from SQLite by iterating through projects
        let mut sqlite_recordings = Vec::new();
        let projects = self.sqlite_db.list_projects().await
            .map_err(|e| MongoError::Migration(format!("Failed to load SQLite projects: {}", e)))?;

        for project in projects {
            let project_recordings = self.sqlite_db.list_recordings(&project.id).await
                .map_err(|e| MongoError::Migration(format!("Failed to load recordings for project {}: {}", project.id, e)))?;
            sqlite_recordings.extend(project_recordings);
        }

        let recording_collection = super::collections::RecordingCollection::new(&self.mongo_db);

        for sqlite_recording in sqlite_recordings {
            match self.migrate_single_recording(&recording_collection, sqlite_recording).await {
                Ok(embeddings_count) => {
                    result.migrated_count += 1;
                    result.embeddings_generated += embeddings_count;
                    debug!("Successfully migrated recording: {}", result.migrated_count);
                }
                Err(e) => {
                    result.failed_count += 1;
                    error!("Failed to migrate recording: {}", e);
                    result.errors.push(format!("Recording migration error: {}", e));
                }
            }
        }

        info!("Recordings migration complete: {} migrated, {} failed, {} embeddings generated",
              result.migrated_count, result.failed_count, result.embeddings_generated);

        Ok(result)
    }

    async fn migrate_single_recording(
        &self,
        collection: &super::collections::RecordingCollection,
        sqlite_recording: sqlite_models::Recording,
    ) -> MongoResult<u32> {
        let mut mongo_recording = MongoRecording::from(sqlite_recording.clone());

        // Generate chunks from the transcript
        let chunks = self.generate_text_chunks(&sqlite_recording.enhanced_transcript).await?;
        mongo_recording.chunks = chunks;

        // Generate main embedding for the full transcript
        let main_embedding = self.vector_search.embedding_service
            .generate_embedding(&sqlite_recording.enhanced_transcript)
            .await
            .map_err(|e| MongoError::VectorSearch(format!("Failed to generate main embedding: {}", e)))?;

        mongo_recording.embedding = Some(main_embedding);

        // Extract topics (placeholder implementation)
        mongo_recording.metadata.topics = self.extract_topics(&sqlite_recording.enhanced_transcript);

        // Create the recording
        collection.create(mongo_recording).await?;

        Ok(mongo_recording.chunks.len() as u32 + 1) // chunks + main embedding
    }

    /// Generate text chunks with embeddings from transcript
    async fn generate_text_chunks(&self, transcript: &str) -> MongoResult<Vec<TextChunk>> {
        let chunk_size = 500; // words
        let overlap = 50; // words

        let words: Vec<&str> = transcript.split_whitespace().collect();
        let mut chunks = Vec::new();

        let mut start = 0;
        while start < words.len() {
            let end = std::cmp::min(start + chunk_size, words.len());
            let chunk_text = words[start..end].join(" ");

            // Generate embedding for chunk
            let embedding = self.vector_search.embedding_service
                .generate_embedding(&chunk_text)
                .await
                .map_err(|e| MongoError::VectorSearch(format!("Failed to generate chunk embedding: {}", e)))?;

            // Extract topics for chunk (placeholder)
            let topics = self.extract_chunk_topics(&chunk_text);

            let chunk = TextChunk {
                chunk_id: Uuid::new_v4().to_string(),
                text: chunk_text,
                start_time: 0.0, // TODO: Calculate from actual timing data
                end_time: 0.0,
                embedding,
                topics,
                confidence: 0.9, // Placeholder
                speaker: None,
            };

            chunks.push(chunk);

            // Move start position, accounting for overlap
            start = if end == words.len() {
                words.len() // End of text
            } else {
                end - overlap
            };
        }

        debug!("Generated {} chunks from transcript", chunks.len());
        Ok(chunks)
    }

    /// Migrate analysis results
    async fn migrate_analysis_results(&self) -> MongoResult<MigrationPhaseResult> {
        let mut result = MigrationPhaseResult::new();

        // Note: Analysis results migration is not implemented yet as the SQLite schema
        // doesn't have an analysis_results table. This is a placeholder for future implementation.

        warn!("Analysis results migration not yet implemented - skipping analysis migration");

        info!("Analysis migration complete: {} migrated, {} failed",
              result.migrated_count, result.failed_count);

        Ok(result)
    }

    async fn migrate_single_analysis(
        &self,
        collection: &super::collections::AnalysisResultCollection,
        // analysis: sqlite_models::AnalysisResult, // TODO: Define this model
        analysis: String, // Placeholder
    ) -> MongoResult<()> {
        // TODO: Implement analysis migration
        // This is a placeholder since the analysis model isn't defined yet
        debug!("Migrating analysis: {}", analysis);
        Ok(())
    }

    /// Generate knowledge base from existing content
    async fn generate_knowledge_base(&self) -> MongoResult<KnowledgeGenerationResult> {
        let mut result = KnowledgeGenerationResult::new();

        // Get all projects to generate knowledge for each
        let projects = self.mongo_db.projects().find(None, None).await?;
        let knowledge_collection = super::collections::KnowledgeBaseCollection::new(&self.mongo_db);

        use futures_util::stream::StreamExt;
        while let Some(project) = projects.next().await {
            let project = project?;

            match self.generate_project_knowledge_base(&knowledge_collection, &project).await {
                Ok(count) => {
                    result.created_count += count;
                }
                Err(e) => {
                    error!("Failed to generate knowledge base for project {}: {}", project.name, e);
                    result.errors.push(format!("Knowledge generation error for {}: {}", project.name, e));
                }
            }
        }

        info!("Knowledge base generation complete: {} entries created", result.created_count);
        Ok(result)
    }

    async fn generate_project_knowledge_base(
        &self,
        collection: &super::collections::KnowledgeBaseCollection,
        project: &MongoProject,
    ) -> MongoResult<u32> {
        let mut created_count = 0;

        // Get all recordings for this project
        let recordings = self.mongo_db.recordings()
            .find(bson::doc! {"project_id": &project.id}, None)
            .await?;

        use futures_util::stream::StreamExt;
        while let Some(recording) = recordings.next().await {
            let recording = recording?;

            // Create knowledge entry from summary
            if let Some(ref summary) = recording.summary {
                let knowledge_entry = MongoKnowledgeBaseEntry {
                    _id: None,
                    id: Uuid::new_v4().to_string(),
                    project_id: project.id.clone(),
                    content_type: "summary".to_string(),
                    source_id: recording.id.clone(),
                    title: format!("Summary: {}", recording.name),
                    content: summary.clone(),
                    topics: recording.metadata.topics.clone(),
                    entities: Vec::new(), // TODO: Extract entities
                    embedding: self.vector_search.embedding_service
                        .generate_embedding(summary)
                        .await
                        .map_err(|e| MongoError::VectorSearch(e))?,
                    chunk_embeddings: Vec::new(),
                    quality_score: Some(0.8),
                    relevance_score: Some(0.9),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };

                collection.create(knowledge_entry).await?;
                created_count += 1;
            }
        }

        debug!("Created {} knowledge base entries for project: {}", created_count, project.name);
        Ok(created_count)
    }

    /// Extract topics from text (placeholder implementation)
    fn extract_topics(&self, text: &str) -> Vec<String> {
        // This is a simple keyword-based topic extraction
        // In a real implementation, you'd use NLP techniques
        let keywords = vec![
            "meeting", "project", "budget", "deadline", "team", "goal",
            "issue", "risk", "opportunity", "strategy", "plan", "task",
            "client", "customer", "product", "service", "revenue", "cost"
        ];

        let text_lower = text.to_lowercase();
        keywords.into_iter()
            .filter(|keyword| text_lower.contains(*keyword))
            .map(|s| s.to_string())
            .collect()
    }

    /// Extract topics for a text chunk
    fn extract_chunk_topics(&self, text: &str) -> Vec<String> {
        // Similar to extract_topics but more focused on the chunk
        self.extract_topics(text)
            .into_iter()
            .take(3) // Limit to top 3 topics per chunk
            .collect()
    }

    /// Validate migration integrity
    pub async fn validate_migration(&self) -> MongoResult<ValidationReport> {
        info!("Validating migration integrity");

        let mut validation_report = ValidationReport::new();

        // Count records in both databases
        let sqlite_projects = self.sqlite_db.list_projects().await
            .map_err(|e| MongoError::Migration(format!("Failed to count SQLite projects: {}", e)))?;
        let sqlite_project_count = sqlite_projects.len() as u32;

        let mongo_project_count = self.mongo_db.projects().estimated_document_count(None).await? as u32;

        // Count recordings by iterating through projects
        let mut sqlite_recording_count = 0u32;
        for project in &sqlite_projects {
            let recordings = self.sqlite_db.list_recordings(&project.id).await
                .map_err(|e| MongoError::Migration(format!("Failed to count recordings for project {}: {}", project.id, e)))?;
            sqlite_recording_count += recordings.len() as u32;
        }

        let mongo_recording_count = self.mongo_db.recordings().estimated_document_count(None).await? as u32;

        validation_report.projects_sqlite = sqlite_project_count;
        validation_report.projects_mongo = mongo_project_count;
        validation_report.recordings_sqlite = sqlite_recording_count;
        validation_report.recordings_mongo = mongo_recording_count;

        // Check data integrity
        validation_report.projects_match = sqlite_project_count == mongo_project_count;
        validation_report.recordings_match = sqlite_recording_count == mongo_recording_count;

        validation_report.overall_success = validation_report.projects_match && validation_report.recordings_match;

        if validation_report.overall_success {
            info!("Migration validation passed: all data migrated successfully");
        } else {
            warn!("Migration validation failed: data counts don't match");
        }

        Ok(validation_report)
    }
}

/// Migration report with statistics and results
#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationReport {
    pub success: bool,
    pub projects_migrated: u32,
    pub projects_failed: u32,
    pub recordings_migrated: u32,
    pub recordings_failed: u32,
    pub analysis_migrated: u32,
    pub analysis_failed: u32,
    pub embeddings_generated: u32,
    pub knowledge_entries_created: u32,
    pub total_time: std::time::Duration,
    pub errors: Vec<String>,
}

impl MigrationReport {
    fn new() -> Self {
        Self {
            success: false,
            projects_migrated: 0,
            projects_failed: 0,
            recordings_migrated: 0,
            recordings_failed: 0,
            analysis_migrated: 0,
            analysis_failed: 0,
            embeddings_generated: 0,
            knowledge_entries_created: 0,
            total_time: std::time::Duration::ZERO,
            errors: Vec::new(),
        }
    }

    pub fn summary(&self) -> String {
        format!(
            "Migration Report: {} projects, {} recordings, {} embeddings, {} knowledge entries in {:?}",
            self.projects_migrated,
            self.recordings_migrated,
            self.embeddings_generated,
            self.knowledge_entries_created,
            self.total_time
        )
    }
}

/// Result for a single migration phase
#[derive(Debug)]
struct MigrationPhaseResult {
    migrated_count: u32,
    failed_count: u32,
    embeddings_generated: u32,
    errors: Vec<String>,
}

impl MigrationPhaseResult {
    fn new() -> Self {
        Self {
            migrated_count: 0,
            failed_count: 0,
            embeddings_generated: 0,
            errors: Vec::new(),
        }
    }
}

/// Result for knowledge base generation
#[derive(Debug)]
struct KnowledgeGenerationResult {
    created_count: u32,
    errors: Vec<String>,
}

impl KnowledgeGenerationResult {
    fn new() -> Self {
        Self {
            created_count: 0,
            errors: Vec::new(),
        }
    }
}

/// Validation report for migration integrity
#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationReport {
    pub overall_success: bool,
    pub projects_sqlite: u32,
    pub projects_mongo: u32,
    pub projects_match: bool,
    pub recordings_sqlite: u32,
    pub recordings_mongo: u32,
    pub recordings_match: bool,
}

impl ValidationReport {
    fn new() -> Self {
        Self {
            overall_success: false,
            projects_sqlite: 0,
            projects_mongo: 0,
            projects_match: false,
            recordings_sqlite: 0,
            recordings_mongo: 0,
            recordings_match: false,
        }
    }
}