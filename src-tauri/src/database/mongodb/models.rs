/// MongoDB document models for Causal application
///
/// Defines the document structures for MongoDB collections with proper
/// serialization and compatibility with existing SQLite models.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// MongoDB Project document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MongoProject {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub _id: Option<ObjectId>,

    /// UUID for compatibility with existing system
    pub id: String,
    pub name: String,
    pub description: String,
    pub api_key_reference: Option<String>,

    /// Project-specific settings
    pub settings: ProjectSettings,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Project settings including RAG configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSettings {
    pub embedding_model: String,
    pub rag_config: RAGConfig,
    pub analysis_preferences: AnalysisPreferences,
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            embedding_model: "voyage-2".to_string(),
            rag_config: RAGConfig::default(),
            analysis_preferences: AnalysisPreferences::default(),
        }
    }
}

/// RAG configuration for the project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RAGConfig {
    pub context_window: usize,
    pub similarity_threshold: f32,
    pub max_results: usize,
    pub enable_cross_project: bool,
}

impl Default for RAGConfig {
    fn default() -> Self {
        Self {
            context_window: 8000,
            similarity_threshold: 0.7,
            max_results: 5,
            enable_cross_project: false,
        }
    }
}

/// Analysis preferences for AI processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisPreferences {
    pub auto_summarize: bool,
    pub extract_action_items: bool,
    pub sentiment_analysis: bool,
    pub topic_extraction: bool,
}

impl Default for AnalysisPreferences {
    fn default() -> Self {
        Self {
            auto_summarize: true,
            extract_action_items: true,
            sentiment_analysis: true,
            topic_extraction: true,
        }
    }
}

/// MongoDB Recording document with enhanced metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MongoRecording {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub _id: Option<ObjectId>,

    /// UUID for compatibility
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub raw_transcript: String,
    pub enhanced_transcript: String,
    pub summary: Option<String>,
    pub key_points: Vec<String>,
    pub action_items: Vec<String>,

    /// Enhanced metadata for better RAG
    pub metadata: RecordingMetadata,

    /// Text chunks for granular RAG retrieval
    pub chunks: Vec<TextChunk>,

    /// Recording status
    pub status: RecordingStatus,

    pub created_at: DateTime<Utc>,

    /// Primary embedding for the full recording
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedding: Option<Vec<f32>>,
}

/// Enhanced recording metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingMetadata {
    pub duration_seconds: f64,
    pub word_count: usize,
    pub chunk_count: usize,
    pub turn_count: usize,
    pub average_confidence: f64,

    /// Extracted topics for better categorization
    pub topics: Vec<String>,

    /// Overall sentiment score (-1.0 to 1.0)
    pub sentiment_score: Option<f32>,

    /// Detected language
    pub language: String,

    /// Quality metrics
    pub audio_quality: Option<f32>,
    pub transcription_quality: Option<f32>,
}

/// Text chunk for granular search and retrieval
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextChunk {
    pub chunk_id: String,
    pub text: String,
    pub start_time: f64,
    pub end_time: f64,

    /// Chunk-specific embedding
    pub embedding: Vec<f32>,

    /// Topics relevant to this chunk
    pub topics: Vec<String>,

    /// Confidence score for this chunk
    pub confidence: f32,

    /// Speaker information (if available)
    pub speaker: Option<String>,
}

/// Recording status enum
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordingStatus {
    Recording,
    Processing,
    Completed,
    Failed,
}

/// MongoDB Analysis Result document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MongoAnalysisResult {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub _id: Option<ObjectId>,

    pub recording_id: String,
    pub project_id: String,
    pub analysis_type: String,

    /// Structured analysis content
    pub analysis_content: AnalysisContent,

    pub input_text: String,

    /// Context used for this analysis
    pub context_used: Vec<ContextReference>,

    pub timestamp: DateTime<Utc>,

    /// Analysis embedding for similarity search
    pub embedding: Vec<f32>,

    pub embedding_model: String,

    /// Processing metadata
    pub processing_metadata: ProcessingMetadata,
}

/// Structured analysis content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisContent {
    pub summary: String,
    pub insights: Vec<String>,
    pub recommendations: Vec<String>,
    pub confidence: f32,

    /// Type-specific data
    pub type_specific_data: Option<bson::Document>,
}

/// Reference to context used in analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextReference {
    pub source_id: String,
    pub source_type: String, // "recording", "analysis", "knowledge"
    pub similarity_score: f32,
    pub text_snippet: String,
}

/// Processing metadata for analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingMetadata {
    pub confidence_score: Option<f32>,
    pub processing_time_ms: Option<i64>,
    pub context_length: Option<i64>,
    pub tokens_used: Option<u32>,
    pub model_version: Option<String>,
}

/// MongoDB Knowledge Base Entry document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MongoKnowledgeBaseEntry {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub _id: Option<ObjectId>,

    pub id: String,
    pub project_id: String,
    pub content_type: String, // "transcript", "analysis", "summary", "external"
    pub source_id: String,
    pub title: String,
    pub content: String,

    /// Semantic metadata
    pub topics: Vec<String>,
    pub entities: Vec<EntityExtraction>,

    /// Primary content embedding
    pub embedding: Vec<f32>,

    /// Sub-document chunk embeddings for larger content
    pub chunk_embeddings: Vec<ChunkEmbedding>,

    /// Quality and confidence metrics
    pub quality_score: Option<f32>,
    pub relevance_score: Option<f32>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Extracted entity information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityExtraction {
    pub name: String,
    pub entity_type: String, // "person", "company", "topic", "location", etc.
    pub confidence: f32,
    pub mentions: u32,
}

/// Chunk embedding for large documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkEmbedding {
    pub text: String,
    pub embedding: Vec<f32>,
    pub position: usize,
    pub topics: Vec<String>,
}

/// MongoDB Secure Setting document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MongoSecureSetting {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub _id: Option<ObjectId>,

    /// Setting key (unique)
    pub key: String,

    /// Encrypted value
    pub encrypted_value: Vec<u8>,

    /// Salt used for encryption
    pub salt: Vec<u8>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Conversion functions for compatibility with existing models

impl From<crate::database::models::Project> for MongoProject {
    fn from(project: crate::database::models::Project) -> Self {
        Self {
            _id: None,
            id: project.id,
            name: project.name,
            description: project.description,
            api_key_reference: project.api_key_reference,
            settings: ProjectSettings::default(),
            created_at: DateTime::from(project.created_at),
            updated_at: DateTime::from(project.updated_at),
        }
    }
}

impl From<MongoProject> for crate::database::models::Project {
    fn from(mongo_project: MongoProject) -> Self {
        Self {
            id: mongo_project.id,
            name: mongo_project.name,
            description: mongo_project.description,
            api_key_reference: mongo_project.api_key_reference,
            created_at: mongo_project.created_at.into(),
            updated_at: mongo_project.updated_at.into(),
        }
    }
}

impl From<crate::database::models::Recording> for MongoRecording {
    fn from(recording: crate::database::models::Recording) -> Self {
        Self {
            _id: None,
            id: recording.id,
            project_id: recording.project_id,
            name: recording.name,
            raw_transcript: recording.raw_transcript,
            enhanced_transcript: recording.enhanced_transcript,
            summary: recording.summary,
            key_points: recording.key_points,
            action_items: recording.action_items,
            metadata: RecordingMetadata {
                duration_seconds: recording.metadata.duration_seconds,
                word_count: recording.metadata.word_count,
                chunk_count: recording.metadata.chunk_count,
                turn_count: recording.metadata.turn_count,
                average_confidence: recording.metadata.average_confidence,
                topics: Vec::new(), // Will be extracted during migration
                sentiment_score: None,
                language: "en".to_string(),
                audio_quality: None,
                transcription_quality: None,
            },
            chunks: Vec::new(), // Will be generated during migration
            status: match recording.status {
                crate::database::models::RecordingStatus::Recording => RecordingStatus::Recording,
                crate::database::models::RecordingStatus::Processing => RecordingStatus::Processing,
                crate::database::models::RecordingStatus::Completed => RecordingStatus::Completed,
                crate::database::models::RecordingStatus::Failed => RecordingStatus::Failed,
            },
            created_at: DateTime::from(recording.created_at),
            embedding: None, // Will be generated during migration
        }
    }
}