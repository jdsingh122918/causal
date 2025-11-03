use serde::{Deserialize, Serialize};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(with = "crate::database::serde_helpers")]
    pub created_at: SystemTime,
    #[serde(with = "crate::database::serde_helpers")]
    pub updated_at: SystemTime,
}

impl Project {
    pub fn new(name: String, description: String) -> Self {
        let now = SystemTime::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            description,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingMetadata {
    pub duration_seconds: f64,
    pub word_count: usize,
    pub chunk_count: usize,
    pub turn_count: usize,
    pub average_confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecordingStatus {
    Recording,
    Processing,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recording {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub raw_transcript: String,
    pub enhanced_transcript: String,
    pub summary: Option<String>,
    pub key_points: Vec<String>,
    pub action_items: Vec<String>,
    pub metadata: RecordingMetadata,
    pub status: RecordingStatus,
    #[serde(with = "crate::database::serde_helpers")]
    pub created_at: SystemTime,
}

impl Recording {
    pub fn new(
        project_id: String,
        name: String,
        raw_transcript: String,
        enhanced_transcript: String,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            project_id,
            name,
            raw_transcript,
            enhanced_transcript,
            summary: None,
            key_points: Vec::new(),
            action_items: Vec::new(),
            metadata: RecordingMetadata {
                duration_seconds: 0.0,
                word_count: 0,
                chunk_count: 0,
                turn_count: 0,
                average_confidence: 0.0,
            },
            status: RecordingStatus::Completed,
            created_at: SystemTime::now(),
        }
    }

    pub fn with_summary(
        mut self,
        summary: String,
        key_points: Vec<String>,
        action_items: Vec<String>,
    ) -> Self {
        self.summary = Some(summary);
        self.key_points = key_points;
        self.action_items = action_items;
        self
    }

    pub fn with_metadata(mut self, metadata: RecordingMetadata) -> Self {
        self.metadata = metadata;
        self
    }
}
