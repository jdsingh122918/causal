/// MongoDB Atlas Vector Search integration
///
/// Provides vector search capabilities using MongoDB Atlas Vector Search
/// with VoyageAI embeddings for semantic similarity queries.

use super::{MongoDatabase, MongoError, MongoResult, ContextConfig, SearchFilters};
use super::models::*;
use bson::{doc, Document};
use mongodb::Collection;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, Duration, TimeZone};
use tracing::{debug, info, warn, error};

/// Atlas Vector Search service
#[derive(Clone)]
pub struct AtlasVectorSearch {
    database: MongoDatabase,
    pub embedding_service: AtlasEmbeddingService,
}

impl AtlasVectorSearch {
    pub fn new(database: MongoDatabase, atlas_api_key: String) -> Self {
        let embedding_service = AtlasEmbeddingService::new(atlas_api_key);

        Self {
            database,
            embedding_service,
        }
    }

    /// Perform semantic search across recordings
    pub async fn search_recordings(
        &self,
        query: &str,
        config: &ContextConfig,
        filters: &SearchFilters,
    ) -> MongoResult<Vec<RecordingSearchResult>> {
        info!("Performing vector search for query: \"{}\"", query);

        // Generate query embedding
        let query_embedding = self.embedding_service
            .generate_embedding(query)
            .await
            .map_err(|e| MongoError::VectorSearch(format!("Failed to generate embedding: {}", e)))?;

        // Build vector search pipeline
        let pipeline = self.build_recording_search_pipeline(
            &query_embedding,
            config,
            filters,
        )?;

        // Execute search
        let collection = self.database.recordings();
        let mut cursor = collection.aggregate(pipeline).await?;

        let mut results = Vec::new();
        use futures_util::stream::StreamExt;

        while let Some(doc) = cursor.next().await {
            let doc = doc?;
            let result = self.parse_recording_search_result(doc)?;
            results.push(result);
        }

        debug!("Found {} recording results for vector search", results.len());
        Ok(results)
    }

    /// Search knowledge base for relevant context
    pub async fn search_knowledge_base(
        &self,
        query: &str,
        project_id: &str,
        config: &ContextConfig,
    ) -> MongoResult<Vec<KnowledgeSearchResult>> {
        info!("Searching knowledge base for project: {}", project_id);

        // Generate query embedding
        let query_embedding = self.embedding_service
            .generate_embedding(query)
            .await
            .map_err(|e| MongoError::VectorSearch(format!("Failed to generate embedding: {}", e)))?;

        // Build vector search pipeline
        let pipeline = self.build_knowledge_search_pipeline(
            &query_embedding,
            project_id,
            config,
        )?;

        // Execute search
        let collection = self.database.knowledge_base();
        let mut cursor = collection.aggregate(pipeline).await?;

        let mut results = Vec::new();
        use futures_util::stream::StreamExt;

        while let Some(doc) = cursor.next().await {
            let doc = doc?;
            let result = self.parse_knowledge_search_result(doc)?;
            results.push(result);
        }

        debug!("Found {} knowledge base results", results.len());
        Ok(results)
    }

    /// Get contextual information for enhanced analysis
    pub async fn get_analysis_context(
        &self,
        text: &str,
        project_id: &str,
        analysis_type: &str,
        config: &ContextConfig,
    ) -> MongoResult<AnalysisContext> {
        // Generate embedding for the input text
        let text_embedding = self.embedding_service
            .generate_embedding(text)
            .await
            .map_err(|e| MongoError::VectorSearch(format!("Failed to generate embedding: {}", e)))?;

        // Search for similar analysis results
        let similar_analyses = self.search_similar_analyses(
            &text_embedding,
            project_id,
            analysis_type,
            config,
        ).await?;

        // Search for relevant recordings
        let relevant_recordings = self.search_recordings(
            text,
            config,
            &SearchFilters {
                project_ids: Some(vec![project_id.to_string()]),
                content_types: None,
                date_range: config.time_range_days.map(|days| super::DateRange {
                    start: Utc::now() - Duration::days(days as i64),
                    end: Utc::now(),
                }),
                topics: None,
                min_confidence: Some(0.7),
            },
        ).await?;

        // Search knowledge base
        let knowledge_context = self.search_knowledge_base(
            text,
            project_id,
            config,
        ).await?;

        let context_summary = self.generate_context_summary(
            &similar_analyses,
            &relevant_recordings,
            &knowledge_context,
        );

        Ok(AnalysisContext {
            similar_analyses,
            relevant_recordings,
            knowledge_context,
            context_summary,
        })
    }

    /// Build vector search pipeline for recordings
    fn build_recording_search_pipeline(
        &self,
        query_embedding: &[f32],
        config: &ContextConfig,
        filters: &SearchFilters,
    ) -> MongoResult<Vec<Document>> {
        let mut pipeline = Vec::new();

        // Vector search stage
        let mut vector_search = doc! {
            "$vectorSearch": {
                "index": "recording_vector_index",
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": (config.max_results * 10) as i32,
                "limit": config.max_results as i32
            }
        };

        // Add filters
        let mut filter_conditions = vec![];

        if let Some(ref project_ids) = filters.project_ids {
            if project_ids.len() == 1 {
                filter_conditions.push(doc! {"project_id": &project_ids[0]});
            } else {
                filter_conditions.push(doc! {"project_id": {"$in": project_ids}});
            }
        }

        if let Some(ref date_range) = filters.date_range {
            filter_conditions.push(doc! {
                "created_at": {
                    "$gte": bson::DateTime::from_system_time(date_range.start.into()),
                    "$lte": bson::DateTime::from_system_time(date_range.end.into())
                }
            });
        }

        // Only search completed recordings
        filter_conditions.push(doc! {"status": "completed"});

        if !filter_conditions.is_empty() {
            vector_search.get_document_mut("$vectorSearch").unwrap()
                .insert("filter", doc! {"$and": filter_conditions});
        }

        pipeline.push(vector_search);

        // Add similarity score
        pipeline.push(doc! {
            "$addFields": {
                "similarity_score": {"$meta": "vectorSearchScore"}
            }
        });

        // Filter by similarity threshold
        pipeline.push(doc! {
            "$match": {
                "similarity_score": {"$gte": config.similarity_threshold}
            }
        });

        // Project relevant fields
        pipeline.push(doc! {
            "$project": {
                "id": 1,
                "project_id": 1,
                "name": 1,
                "enhanced_transcript": 1,
                "summary": 1,
                "metadata": 1,
                "created_at": 1,
                "similarity_score": 1
            }
        });

        Ok(pipeline)
    }

    /// Build vector search pipeline for knowledge base
    fn build_knowledge_search_pipeline(
        &self,
        query_embedding: &[f32],
        project_id: &str,
        config: &ContextConfig,
    ) -> MongoResult<Vec<Document>> {
        let mut pipeline = Vec::new();

        // Vector search stage with project filter
        let vector_search = doc! {
            "$vectorSearch": {
                "index": "knowledge_vector_index",
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": (config.max_results * 10) as i32,
                "limit": config.max_results as i32,
                "filter": {
                    "project_id": project_id
                }
            }
        };

        pipeline.push(vector_search);

        // Add similarity score
        pipeline.push(doc! {
            "$addFields": {
                "similarity_score": {"$meta": "vectorSearchScore"}
            }
        });

        // Filter by similarity threshold
        pipeline.push(doc! {
            "$match": {
                "similarity_score": {"$gte": config.similarity_threshold}
            }
        });

        Ok(pipeline)
    }

    /// Search for similar analysis results
    async fn search_similar_analyses(
        &self,
        embedding: &[f32],
        project_id: &str,
        analysis_type: &str,
        config: &ContextConfig,
    ) -> MongoResult<Vec<AnalysisSearchResult>> {
        let pipeline = vec![
            doc! {
                "$vectorSearch": {
                    "index": "analysis_vector_index",
                    "path": "embedding",
                    "queryVector": embedding,
                    "numCandidates": (config.max_results * 5) as i32,
                    "limit": config.max_results as i32,
                    "filter": {
                        "project_id": project_id,
                        "analysis_type": analysis_type
                    }
                }
            },
            doc! {
                "$addFields": {
                    "similarity_score": {"$meta": "vectorSearchScore"}
                }
            },
            doc! {
                "$match": {
                    "similarity_score": {"$gte": config.similarity_threshold}
                }
            }
        ];

        let collection = self.database.analysis_results();
        let mut cursor = collection.aggregate(pipeline).await?;

        let mut results = Vec::new();
        use futures_util::stream::StreamExt;

        while let Some(doc) = cursor.next().await {
            let doc = doc?;
            let result = self.parse_analysis_search_result(doc)?;
            results.push(result);
        }

        Ok(results)
    }

    /// Parse recording search result from MongoDB document
    fn parse_recording_search_result(&self, doc: Document) -> MongoResult<RecordingSearchResult> {
        let id = doc.get_str("id").map_err(|e| MongoError::VectorSearch(format!("Missing id field: {}", e)))?.to_string();
        let project_id = doc.get_str("project_id").map_err(|e| MongoError::VectorSearch(format!("Missing project_id field: {}", e)))?.to_string();
        let name = doc.get_str("name").map_err(|e| MongoError::VectorSearch(format!("Missing name field: {}", e)))?.to_string();
        let enhanced_transcript = doc.get_str("enhanced_transcript").map_err(|e| MongoError::VectorSearch(format!("Missing enhanced_transcript field: {}", e)))?.to_string();
        let summary = doc.get_str("summary").ok().map(|s| s.to_string());
        let similarity_score = doc.get_f64("similarity_score").map_err(|e| MongoError::VectorSearch(format!("Missing similarity_score field: {}", e)))? as f32;
        let created_at = doc.get_datetime("created_at").map_err(|e| MongoError::VectorSearch(format!("Missing created_at field: {}", e)))?;

        Ok(RecordingSearchResult {
            id,
            project_id,
            name,
            enhanced_transcript,
            summary,
            similarity_score,
            created_at: DateTime::<Utc>::from_timestamp_millis(created_at.timestamp_millis()).unwrap_or(Utc::now()),
        })
    }

    /// Parse knowledge search result from MongoDB document
    fn parse_knowledge_search_result(&self, doc: Document) -> MongoResult<KnowledgeSearchResult> {
        let id = doc.get_str("id").map_err(|e| MongoError::VectorSearch(format!("Missing id field: {}", e)))?.to_string();
        let title = doc.get_str("title").map_err(|e| MongoError::VectorSearch(format!("Missing title field: {}", e)))?.to_string();
        let content = doc.get_str("content").map_err(|e| MongoError::VectorSearch(format!("Missing content field: {}", e)))?.to_string();
        let content_type = doc.get_str("content_type").map_err(|e| MongoError::VectorSearch(format!("Missing content_type field: {}", e)))?.to_string();
        let similarity_score = doc.get_f64("similarity_score").map_err(|e| MongoError::VectorSearch(format!("Missing similarity_score field: {}", e)))? as f32;

        Ok(KnowledgeSearchResult {
            id,
            title,
            content,
            content_type,
            similarity_score,
        })
    }

    /// Parse analysis search result from MongoDB document
    fn parse_analysis_search_result(&self, doc: Document) -> MongoResult<AnalysisSearchResult> {
        let recording_id = doc.get_str("recording_id").map_err(|e| MongoError::VectorSearch(format!("Missing recording_id field: {}", e)))?.to_string();
        let analysis_type = doc.get_str("analysis_type").map_err(|e| MongoError::VectorSearch(format!("Missing analysis_type field: {}", e)))?.to_string();
        let input_text = doc.get_str("input_text").map_err(|e| MongoError::VectorSearch(format!("Missing input_text field: {}", e)))?.to_string();
        let similarity_score = doc.get_f64("similarity_score").map_err(|e| MongoError::VectorSearch(format!("Missing similarity_score field: {}", e)))? as f32;
        let timestamp = doc.get_datetime("timestamp").map_err(|e| MongoError::VectorSearch(format!("Missing timestamp field: {}", e)))?;

        // Parse analysis_content (assuming it's a document with summary field)
        let analysis_content = doc.get_document("analysis_content")
            .map_err(|e| MongoError::VectorSearch(format!("Missing analysis_content field: {}", e)))?;
        let summary = analysis_content.get_str("summary")
            .map_err(|e| MongoError::VectorSearch(format!("Missing summary in analysis_content: {}", e)))?
            .to_string();

        Ok(AnalysisSearchResult {
            recording_id,
            analysis_type,
            summary,
            input_text,
            similarity_score,
            timestamp: DateTime::<Utc>::from_timestamp_millis(timestamp.timestamp_millis()).unwrap_or(Utc::now()),
        })
    }

    /// Generate a summary of the retrieved context
    fn generate_context_summary(
        &self,
        analyses: &[AnalysisSearchResult],
        recordings: &[RecordingSearchResult],
        knowledge: &[KnowledgeSearchResult],
    ) -> String {
        let mut summary_parts = Vec::new();

        if !analyses.is_empty() {
            summary_parts.push(format!("Found {} similar past analyses", analyses.len()));
        }

        if !recordings.is_empty() {
            summary_parts.push(format!("Found {} relevant recordings", recordings.len()));
        }

        if !knowledge.is_empty() {
            summary_parts.push(format!("Found {} knowledge base entries", knowledge.len()));
        }

        if summary_parts.is_empty() {
            "No relevant context found".to_string()
        } else {
            summary_parts.join(", ")
        }
    }
}

/// Atlas embedding service for generating embeddings
#[derive(Clone)]
pub struct AtlasEmbeddingService {
    client: reqwest::Client,
    api_key: String,
}

impl AtlasEmbeddingService {
    pub fn new(api_key: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key,
        }
    }

    /// Generate embedding using VoyageAI API
    pub async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>, String> {
        debug!("Generating VoyageAI embedding for text: {} chars", text.len());

        let request_body = serde_json::json!({
            "model": "voyage-2",
            "input": [text],
            "input_type": "document",
            "truncation": true
        });

        let response = self.client
            .post("https://api.voyageai.com/v1/embeddings")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let status = response.status();
        let response_text = response.text().await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            return Err(format!("VoyageAI API request failed with status {}: {}", status, response_text));
        }

        let response_body: VoyageAIResponse = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse VoyageAI response: {}. Response: {}", e, response_text))?;

        // Extract the first (and only) embedding from the response
        response_body.data.first()
            .ok_or_else(|| "No embeddings returned from VoyageAI API".to_string())
            .map(|embedding_data| embedding_data.embedding.clone())
    }

    /// Generate embeddings in batch for migration
    pub async fn batch_generate_embeddings(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        let mut all_embeddings = Vec::new();

        // VoyageAI API supports batch requests, so we can send multiple texts at once
        // Process in smaller batches to avoid API limits (max 128 texts per request)
        for chunk in texts.chunks(64) {
            debug!("Generating VoyageAI embeddings for batch of {} texts", chunk.len());

            let request_body = serde_json::json!({
                "model": "voyage-2",
                "input": chunk,
                "input_type": "document",
                "truncation": true
            });

            let response = self.client
                .post("https://api.voyageai.com/v1/embeddings")
                .header("Authorization", format!("Bearer {}", self.api_key))
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
                .await
                .map_err(|e| format!("Batch HTTP request failed: {}", e))?;

            let status = response.status();
            let response_text = response.text().await
                .map_err(|e| format!("Failed to read batch response: {}", e))?;

            if !status.is_success() {
                return Err(format!("VoyageAI batch API request failed with status {}: {}", status, response_text));
            }

            let response_body: VoyageAIResponse = serde_json::from_str(&response_text)
                .map_err(|e| format!("Failed to parse VoyageAI batch response: {}. Response: {}", e, response_text))?;

            // Sort embeddings by index to maintain order
            let mut sorted_embeddings = response_body.data;
            sorted_embeddings.sort_by_key(|emb| emb.index);

            // Extract embeddings in the correct order
            for embedding_data in sorted_embeddings {
                all_embeddings.push(embedding_data.embedding);
            }

            // Add delay to avoid rate limiting (VoyageAI has rate limits)
            if chunk.len() >= 10 {
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            }
        }

        info!("Generated {} embeddings using VoyageAI batch API", all_embeddings.len());
        Ok(all_embeddings)
    }
}

/// Response from VoyageAI embedding API
#[derive(Debug, Serialize, Deserialize)]
struct VoyageAIResponse {
    data: Vec<VoyageAIEmbedding>,
    model: String,
    usage: Option<VoyageAIUsage>,
}

#[derive(Debug, Serialize, Deserialize)]
struct VoyageAIEmbedding {
    embedding: Vec<f32>,
    index: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct VoyageAIUsage {
    total_tokens: u32,
}

/// Search result types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSearchResult {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub enhanced_transcript: String,
    pub summary: Option<String>,
    pub similarity_score: f32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeSearchResult {
    pub id: String,
    pub title: String,
    pub content: String,
    pub content_type: String,
    pub similarity_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisSearchResult {
    pub recording_id: String,
    pub analysis_type: String,
    pub summary: String,
    pub input_text: String,
    pub similarity_score: f32,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisContext {
    pub similar_analyses: Vec<AnalysisSearchResult>,
    pub relevant_recordings: Vec<RecordingSearchResult>,
    pub knowledge_context: Vec<KnowledgeSearchResult>,
    pub context_summary: String,
}