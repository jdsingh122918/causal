/// MongoDB collection operations
///
/// Provides high-level CRUD operations for each MongoDB collection
/// with proper error handling and optimized queries.

use super::{MongoDatabase, MongoError, MongoResult, SearchFilters, DateRange};
use super::models::*;
use mongodb::{Collection, options::FindOptions};
use bson::{doc, Document};
use chrono::{DateTime, Utc};
use tracing::{debug, warn};

/// Project collection operations
pub struct ProjectCollection {
    collection: Collection<MongoProject>,
}

impl ProjectCollection {
    pub fn new(db: &MongoDatabase) -> Self {
        Self {
            collection: db.projects(),
        }
    }

    /// Create a new project
    pub async fn create(&self, mut project: MongoProject) -> MongoResult<MongoProject> {
        project.created_at = Utc::now();
        project.updated_at = project.created_at;

        let project_name = project.name.clone();
        let project_id = project.id.clone();

        let result = self.collection.insert_one(&project).await?;
        project._id = result.inserted_id.as_object_id();

        debug!("Created project: {} ({})", project_name, project_id);
        Ok(project)
    }

    /// Get project by ID
    pub async fn get_by_id(&self, id: &str) -> MongoResult<Option<MongoProject>> {
        let filter = doc! {"id": id};
        let result = self.collection.find_one(filter).await?;
        Ok(result)
    }

    /// Get project by name
    pub async fn get_by_name(&self, name: &str) -> MongoResult<Option<MongoProject>> {
        let filter = doc! {"name": name};
        let result = self.collection.find_one(filter).await?;
        Ok(result)
    }

    /// List all projects
    pub async fn list_all(&self) -> MongoResult<Vec<MongoProject>> {
        let options = FindOptions::builder()
            .sort(doc! {"created_at": -1})
            .build();

        let mut cursor = self.collection.find(doc! {}).with_options(options).await?;
        let mut projects = Vec::new();

        use futures_util::stream::StreamExt;
        while let Some(project) = cursor.next().await {
            projects.push(project?);
        }

        Ok(projects)
    }

    /// Update project
    pub async fn update(&self, id: &str, updates: Document) -> MongoResult<bool> {
        let mut update_doc = updates;
        update_doc.insert("updated_at", bson::DateTime::now());

        let filter = doc! {"id": id};
        let update = doc! {"$set": update_doc};

        let result = self.collection.update_one(filter, update).await?;
        Ok(result.modified_count > 0)
    }

    /// Delete project
    pub async fn delete(&self, id: &str) -> MongoResult<bool> {
        let filter = doc! {"id": id};
        let result = self.collection.delete_one(filter).await?;
        Ok(result.deleted_count > 0)
    }
}

/// Recording collection operations
pub struct RecordingCollection {
    collection: Collection<MongoRecording>,
}

impl RecordingCollection {
    pub fn new(db: &MongoDatabase) -> Self {
        Self {
            collection: db.recordings(),
        }
    }

    /// Create a new recording
    pub async fn create(&self, mut recording: MongoRecording) -> MongoResult<MongoRecording> {
        recording.created_at = Utc::now();

        let recording_name = recording.name.clone();
        let recording_project_id = recording.project_id.clone();

        let result = self.collection.insert_one(&recording).await?;
        recording._id = result.inserted_id.as_object_id();

        debug!("Created recording: {} for project: {}", recording_name, recording_project_id);
        Ok(recording)
    }

    /// Get recording by ID
    pub async fn get_by_id(&self, id: &str) -> MongoResult<Option<MongoRecording>> {
        let filter = doc! {"id": id};
        let result = self.collection.find_one(filter).await?;
        Ok(result)
    }

    /// List recordings for a project
    pub async fn list_by_project(&self, project_id: &str) -> MongoResult<Vec<MongoRecording>> {
        let filter = doc! {"project_id": project_id};
        let options = FindOptions::builder()
            .sort(doc! {"created_at": -1})
            .build();

        let mut cursor = self.collection.find(filter).with_options(options).await?;
        let mut recordings = Vec::new();

        use futures_util::stream::StreamExt;
        while let Some(recording) = cursor.next().await {
            recordings.push(recording?);
        }

        Ok(recordings)
    }

    /// Search recordings with filters
    pub async fn search(&self, filters: &SearchFilters) -> MongoResult<Vec<MongoRecording>> {
        let mut filter_doc = Document::new();

        // Project ID filter
        if let Some(ref project_ids) = filters.project_ids {
            if project_ids.len() == 1 {
                filter_doc.insert("project_id", &project_ids[0]);
            } else {
                filter_doc.insert("project_id", doc! {"$in": project_ids});
            }
        }

        // Date range filter
        if let Some(ref date_range) = filters.date_range {
            filter_doc.insert("created_at", doc! {
                "$gte": bson::DateTime::from_system_time(date_range.start.into()),
                "$lte": bson::DateTime::from_system_time(date_range.end.into())
            });
        }

        // Topics filter
        if let Some(ref topics) = filters.topics {
            filter_doc.insert("metadata.topics", doc! {"$in": topics});
        }

        // Status filter (completed recordings only by default)
        filter_doc.insert("status", "completed");

        let options = FindOptions::builder()
            .sort(doc! {"created_at": -1})
            .limit(50) // Limit results for performance
            .build();

        let mut cursor = self.collection.find(filter_doc).with_options(options).await?;
        let mut recordings = Vec::new();

        use futures_util::stream::StreamExt;
        while let Some(recording) = cursor.next().await {
            recordings.push(recording?);
        }

        Ok(recordings)
    }

    /// Update recording
    pub async fn update(&self, id: &str, updates: Document) -> MongoResult<bool> {
        let filter = doc! {"id": id};
        let update = doc! {"$set": updates};

        let result = self.collection.update_one(filter, update).await?;
        Ok(result.modified_count > 0)
    }

    /// Update recording status
    pub async fn update_status(&self, id: &str, status: RecordingStatus) -> MongoResult<bool> {
        let filter = doc! {"id": id};
        let status_str = match status {
            RecordingStatus::Recording => "recording",
            RecordingStatus::Processing => "processing",
            RecordingStatus::Completed => "completed",
            RecordingStatus::Failed => "failed",
        };
        let update = doc! {"$set": {"status": status_str}};

        let result = self.collection.update_one(filter, update).await?;
        Ok(result.modified_count > 0)
    }

    /// Add embedding to recording
    pub async fn add_embedding(&self, id: &str, embedding: Vec<f32>) -> MongoResult<bool> {
        let filter = doc! {"id": id};
        let update = doc! {"$set": {"embedding": embedding}};

        let result = self.collection.update_one(filter, update).await?;
        Ok(result.modified_count > 0)
    }

    /// Delete recording
    pub async fn delete(&self, id: &str) -> MongoResult<bool> {
        let filter = doc! {"id": id};
        let result = self.collection.delete_one(filter).await?;
        Ok(result.deleted_count > 0)
    }

    /// Get recordings count by project
    pub async fn count_by_project(&self, project_id: &str) -> MongoResult<u64> {
        let filter = doc! {"project_id": project_id};
        let count = self.collection.count_documents(filter).await?;
        Ok(count)
    }
}

/// Analysis results collection operations
pub struct AnalysisResultCollection {
    collection: Collection<MongoAnalysisResult>,
}

impl AnalysisResultCollection {
    pub fn new(db: &MongoDatabase) -> Self {
        Self {
            collection: db.analysis_results(),
        }
    }

    /// Create new analysis result
    pub async fn create(&self, mut analysis: MongoAnalysisResult) -> MongoResult<MongoAnalysisResult> {
        analysis.timestamp = Utc::now();

        let analysis_type = analysis.analysis_type.clone();
        let recording_id = analysis.recording_id.clone();

        let result = self.collection.insert_one(&analysis).await?;
        analysis._id = result.inserted_id.as_object_id();

        debug!("Created analysis result: {} for recording: {}",
               analysis_type, recording_id);
        Ok(analysis)
    }

    /// Get analysis results for recording
    pub async fn get_by_recording(&self, recording_id: &str) -> MongoResult<Vec<MongoAnalysisResult>> {
        let filter = doc! {"recording_id": recording_id};
        let options = FindOptions::builder()
            .sort(doc! {"timestamp": -1})
            .build();

        let mut cursor = self.collection.find(filter).with_options(options).await?;
        let mut results = Vec::new();

        use futures_util::stream::StreamExt;
        while let Some(analysis) = cursor.next().await {
            results.push(analysis?);
        }

        Ok(results)
    }

    /// Get analysis results by type and project
    pub async fn get_by_type_and_project(&self,
        analysis_type: &str,
        project_id: &str,
        limit: Option<i64>
    ) -> MongoResult<Vec<MongoAnalysisResult>> {
        let filter = doc! {
            "analysis_type": analysis_type,
            "project_id": project_id
        };

        let options = if let Some(limit) = limit {
            FindOptions::builder()
                .sort(doc! {"timestamp": -1})
                .limit(limit)
                .build()
        } else {
            FindOptions::builder()
                .sort(doc! {"timestamp": -1})
                .build()
        };
        let mut cursor = self.collection.find(filter).with_options(options).await?;
        let mut results = Vec::new();

        use futures_util::stream::StreamExt;
        while let Some(analysis) = cursor.next().await {
            results.push(analysis?);
        }

        Ok(results)
    }
}

/// Knowledge base collection operations
pub struct KnowledgeBaseCollection {
    collection: Collection<MongoKnowledgeBaseEntry>,
}

impl KnowledgeBaseCollection {
    pub fn new(db: &MongoDatabase) -> Self {
        Self {
            collection: db.knowledge_base(),
        }
    }

    /// Create new knowledge base entry
    pub async fn create(&self, mut entry: MongoKnowledgeBaseEntry) -> MongoResult<MongoKnowledgeBaseEntry> {
        let now = Utc::now();
        entry.created_at = now;
        entry.updated_at = now;

        let entry_title = entry.title.clone();
        let entry_project_id = entry.project_id.clone();

        let result = self.collection.insert_one(&entry).await?;
        entry._id = result.inserted_id.as_object_id();

        debug!("Created knowledge base entry: {} for project: {}",
               entry_title, entry_project_id);
        Ok(entry)
    }

    /// Get knowledge entries by project and type
    pub async fn get_by_project_and_type(&self,
        project_id: &str,
        content_type: &str
    ) -> MongoResult<Vec<MongoKnowledgeBaseEntry>> {
        let filter = doc! {
            "project_id": project_id,
            "content_type": content_type
        };

        let options = FindOptions::builder()
            .sort(doc! {"created_at": -1})
            .build();

        let mut cursor = self.collection.find(filter).with_options(options).await?;
        let mut entries = Vec::new();

        use futures_util::stream::StreamExt;
        while let Some(entry) = cursor.next().await {
            entries.push(entry?);
        }

        Ok(entries)
    }

    /// Search by topics
    pub async fn search_by_topics(&self,
        project_id: &str,
        topics: &[String]
    ) -> MongoResult<Vec<MongoKnowledgeBaseEntry>> {
        let filter = doc! {
            "project_id": project_id,
            "topics": doc! {"$in": topics}
        };

        let options = FindOptions::builder()
            .sort(doc! {"relevance_score": -1, "created_at": -1})
            .limit(20)
            .build();

        let mut cursor = self.collection.find(filter).with_options(options).await?;
        let mut entries = Vec::new();

        use futures_util::stream::StreamExt;
        while let Some(entry) = cursor.next().await {
            entries.push(entry?);
        }

        Ok(entries)
    }

    /// Update entry
    pub async fn update(&self, id: &str, updates: Document) -> MongoResult<bool> {
        let mut update_doc = updates;
        update_doc.insert("updated_at", bson::DateTime::now());

        let filter = doc! {"id": id};
        let update = doc! {"$set": update_doc};

        let result = self.collection.update_one(filter, update).await?;
        Ok(result.modified_count > 0)
    }

    /// Delete entry
    pub async fn delete(&self, id: &str) -> MongoResult<bool> {
        let filter = doc! {"id": id};
        let result = self.collection.delete_one(filter).await?;
        Ok(result.deleted_count > 0)
    }
}