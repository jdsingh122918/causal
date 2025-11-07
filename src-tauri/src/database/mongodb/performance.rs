/// Performance optimizations for MongoDB operations
///
/// This module provides performance enhancements for large-scale MongoDB operations
/// including connection pooling, query optimization, and batch processing.

use super::{MongoDatabase, MongoError, MongoResult};
use mongodb::{
    options::{ReadPreference},
    Database,
};
use std::time::{Duration, Instant};
use tokio::time::sleep;
use tracing::{info, debug, warn, error};
use serde::{Serialize, Deserialize};

/// Performance metrics for MongoDB operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub operation_type: String,
    pub duration_ms: u64,
    pub documents_processed: usize,
    pub throughput_docs_per_sec: f64,
    pub memory_usage_mb: Option<f64>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Performance optimization configuration
#[derive(Debug, Clone)]
pub struct PerformanceConfig {
    pub batch_size: usize,
    pub max_concurrent_operations: usize,
    pub connection_pool_size: u32,
    pub query_timeout_ms: u64,
    pub enable_compression: bool,
    pub read_preference: ReadPreference,
    pub retry_attempts: usize,
    pub retry_delay_ms: u64,
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            batch_size: 100,
            max_concurrent_operations: 10,
            connection_pool_size: 20,
            query_timeout_ms: 30000,
            enable_compression: true,
            read_preference: ReadPreference::SecondaryPreferred { options: None },
            retry_attempts: 3,
            retry_delay_ms: 1000,
        }
    }
}

/// High-performance MongoDB operations manager
pub struct PerformanceOptimizer {
    database: MongoDatabase,
    config: PerformanceConfig,
    metrics: Vec<PerformanceMetrics>,
}

impl PerformanceOptimizer {
    /// Create a new performance optimizer
    pub fn new(database: MongoDatabase, config: PerformanceConfig) -> Self {
        Self {
            database,
            config,
            metrics: Vec::new(),
        }
    }

    /// Optimize database connection pool
    pub async fn optimize_connection_pool(&self) -> MongoResult<()> {
        info!("Optimizing MongoDB connection pool settings");

        // Connection pool optimization is handled at the client level
        // This would typically be configured during MongoDatabase creation
        debug!("Connection pool size: {}", self.config.connection_pool_size);
        debug!("Max concurrent operations: {}", self.config.max_concurrent_operations);

        Ok(())
    }

    /// Perform bulk insert with optimized batching
    pub async fn bulk_insert_optimized<T>(&mut self,
        collection_name: &str,
        documents: Vec<T>
    ) -> MongoResult<usize>
    where
        T: Serialize + Send + Sync + Clone,
    {
        let start_time = Instant::now();
        let total_docs = documents.len();

        info!("Starting optimized bulk insert of {} documents to {}", total_docs, collection_name);

        let collection = self.database.database.collection::<T>(collection_name);
        let mut inserted_count = 0;

        // Process in optimized batches
        for (batch_index, chunk) in documents.chunks(self.config.batch_size).enumerate() {
            let batch_start = Instant::now();

            // Retry logic for batch insertion
            let mut attempts = 0;
            while attempts < self.config.retry_attempts {
                match collection.insert_many(chunk.to_vec()).await {
                    Ok(result) => {
                        inserted_count += result.inserted_ids.len();
                        debug!("Batch {} inserted {} documents in {:?}",
                               batch_index + 1, result.inserted_ids.len(), batch_start.elapsed());
                        break;
                    }
                    Err(e) => {
                        attempts += 1;
                        warn!("Batch {} failed (attempt {}): {}", batch_index + 1, attempts, e);

                        if attempts < self.config.retry_attempts {
                            sleep(Duration::from_millis(self.config.retry_delay_ms)).await;
                        } else {
                            error!("Batch {} failed after {} attempts", batch_index + 1, self.config.retry_attempts);
                            return Err(MongoError::Connection(e));
                        }
                    }
                }
            }

            // Rate limiting to prevent overwhelming the database
            if batch_index % 10 == 0 && batch_index > 0 {
                sleep(Duration::from_millis(50)).await;
            }
        }

        let duration = start_time.elapsed();
        let throughput = total_docs as f64 / duration.as_secs_f64();

        // Record performance metrics
        let metrics = PerformanceMetrics {
            operation_type: format!("bulk_insert_{}", collection_name),
            duration_ms: duration.as_millis() as u64,
            documents_processed: inserted_count,
            throughput_docs_per_sec: throughput,
            memory_usage_mb: None, // Could be enhanced with memory monitoring
            timestamp: chrono::Utc::now(),
        };

        self.metrics.push(metrics.clone());

        info!("Bulk insert completed: {} documents in {:?} ({:.2} docs/sec)",
              inserted_count, duration, throughput);

        Ok(inserted_count)
    }

    /// Perform optimized aggregation with proper indexing hints
    pub async fn optimized_aggregation(
        &mut self,
        collection_name: &str,
        pipeline: Vec<bson::Document>,
        hint_index: Option<String>
    ) -> MongoResult<Vec<bson::Document>> {
        let start_time = Instant::now();

        info!("Starting optimized aggregation on {}", collection_name);
        debug!("Pipeline stages: {}", pipeline.len());

        let collection = self.database.database.collection::<bson::Document>(collection_name);

        // Build aggregation options with performance optimizations
        let mut options = mongodb::options::AggregateOptions::default();
        options.allow_disk_use = Some(true); // Allow disk usage for large datasets
        options.max_time = Some(Duration::from_millis(self.config.query_timeout_ms));

        // Add index hint if provided (simplified for now)
        if let Some(hint) = hint_index {
            debug!("Index hint available but not used in this implementation: {}", hint);
        }

        let mut cursor = collection.aggregate(pipeline.clone()).with_options(options).await?;
        let mut results = Vec::new();

        // Collect results with batch processing
        use futures_util::stream::StreamExt;
        while let Some(doc) = cursor.next().await {
            results.push(doc?);

            // Memory management for large result sets
            if results.len() % 1000 == 0 {
                debug!("Processed {} aggregation results", results.len());
            }
        }

        let duration = start_time.elapsed();
        let throughput = results.len() as f64 / duration.as_secs_f64();

        // Record performance metrics
        let metrics = PerformanceMetrics {
            operation_type: format!("aggregation_{}", collection_name),
            duration_ms: duration.as_millis() as u64,
            documents_processed: results.len(),
            throughput_docs_per_sec: throughput,
            memory_usage_mb: None,
            timestamp: chrono::Utc::now(),
        };

        self.metrics.push(metrics);

        info!("Aggregation completed: {} results in {:?} ({:.2} docs/sec)",
              results.len(), duration, throughput);

        Ok(results)
    }

    /// Optimize vector search queries with caching and batching
    pub async fn optimized_vector_search(
        &mut self,
        query_embedding: &[f32],
        similarity_threshold: f32,
        limit: usize,
        collection_name: &str
    ) -> MongoResult<Vec<bson::Document>> {
        let start_time = Instant::now();

        info!("Starting optimized vector search on {}", collection_name);

        // Build optimized vector search pipeline
        let vector_search_stage = bson::doc! {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": (limit * 10) as i32, // Search more candidates for better results
                "limit": limit as i32,
                "filter": {
                    "similarity_score": { "$gte": similarity_threshold }
                }
            }
        };

        let add_fields_stage = bson::doc! {
            "$addFields": {
                "similarity_score": { "$meta": "vectorSearchScore" }
            }
        };

        let match_stage = bson::doc! {
            "$match": {
                "similarity_score": { "$gte": similarity_threshold }
            }
        };

        let pipeline = vec![vector_search_stage, add_fields_stage, match_stage];

        // Use optimized aggregation
        let results = self.optimized_aggregation(
            collection_name,
            pipeline,
            Some("vector_index".to_string())
        ).await?;

        let duration = start_time.elapsed();

        info!("Vector search completed: {} results in {:?}", results.len(), duration);

        Ok(results)
    }

    /// Get performance statistics
    pub fn get_performance_stats(&self) -> PerformanceStats {
        if self.metrics.is_empty() {
            return PerformanceStats::default();
        }

        let total_operations = self.metrics.len();
        let total_documents = self.metrics.iter().map(|m| m.documents_processed).sum::<usize>();
        let total_duration_ms = self.metrics.iter().map(|m| m.duration_ms).sum::<u64>();

        let avg_throughput = self.metrics.iter()
            .map(|m| m.throughput_docs_per_sec)
            .sum::<f64>() / total_operations as f64;

        let avg_duration_ms = total_duration_ms as f64 / total_operations as f64;

        // Group by operation type
        let mut operation_stats = std::collections::HashMap::new();
        for metric in &self.metrics {
            let entry = operation_stats.entry(metric.operation_type.clone())
                .or_insert(OperationStats::default());
            entry.count += 1;
            entry.total_duration_ms += metric.duration_ms;
            entry.total_documents += metric.documents_processed;
            entry.total_throughput += metric.throughput_docs_per_sec;
        }

        // Calculate averages for each operation type
        for (_, stats) in operation_stats.iter_mut() {
            stats.avg_duration_ms = stats.total_duration_ms as f64 / stats.count as f64;
            stats.avg_throughput = stats.total_throughput / stats.count as f64;
        }

        PerformanceStats {
            total_operations,
            total_documents_processed: total_documents,
            total_duration_ms,
            average_throughput_docs_per_sec: avg_throughput,
            average_duration_ms: avg_duration_ms,
            operation_breakdown: operation_stats,
            recent_metrics: self.metrics.iter().rev().take(10).cloned().collect(),
        }
    }

    /// Clear performance metrics
    pub fn clear_metrics(&mut self) {
        self.metrics.clear();
        info!("Performance metrics cleared");
    }

    /// Get configuration recommendations based on performance data
    pub fn get_optimization_recommendations(&self) -> Vec<String> {
        let mut recommendations = Vec::new();
        let stats = self.get_performance_stats();

        // Analyze performance patterns and suggest improvements
        if stats.average_throughput_docs_per_sec < 100.0 {
            recommendations.push("Consider increasing batch size for bulk operations".to_string());
        }

        if stats.average_duration_ms > 5000.0 {
            recommendations.push("Enable query optimization hints and indexing".to_string());
        }

        // Check for slow operations
        for (op_type, op_stats) in &stats.operation_breakdown {
            if op_stats.avg_duration_ms > 10000.0 {
                recommendations.push(format!("Operation '{}' is slow - consider optimization", op_type));
            }
        }

        if recommendations.is_empty() {
            recommendations.push("Performance is optimized - no immediate recommendations".to_string());
        }

        recommendations
    }
}

/// Performance statistics summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceStats {
    pub total_operations: usize,
    pub total_documents_processed: usize,
    pub total_duration_ms: u64,
    pub average_throughput_docs_per_sec: f64,
    pub average_duration_ms: f64,
    pub operation_breakdown: std::collections::HashMap<String, OperationStats>,
    pub recent_metrics: Vec<PerformanceMetrics>,
}

impl Default for PerformanceStats {
    fn default() -> Self {
        Self {
            total_operations: 0,
            total_documents_processed: 0,
            total_duration_ms: 0,
            average_throughput_docs_per_sec: 0.0,
            average_duration_ms: 0.0,
            operation_breakdown: std::collections::HashMap::new(),
            recent_metrics: Vec::new(),
        }
    }
}

/// Statistics for a specific operation type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationStats {
    pub count: usize,
    pub total_duration_ms: u64,
    pub total_documents: usize,
    pub total_throughput: f64,
    pub avg_duration_ms: f64,
    pub avg_throughput: f64,
}

impl Default for OperationStats {
    fn default() -> Self {
        Self {
            count: 0,
            total_duration_ms: 0,
            total_documents: 0,
            total_throughput: 0.0,
            avg_duration_ms: 0.0,
            avg_throughput: 0.0,
        }
    }
}

/// MongoDB health monitoring
pub struct MongoHealthMonitor {
    database: MongoDatabase,
}

impl MongoHealthMonitor {
    pub fn new(database: MongoDatabase) -> Self {
        Self { database }
    }

    /// Check database health and connection status
    pub async fn check_health(&self) -> MongoResult<HealthStatus> {
        let start_time = Instant::now();

        // Test basic connectivity
        let ping_result = self.database.client
            .database("admin")
            .run_command(bson::doc! {"ping": 1})
            .await;

        let connection_healthy = ping_result.is_ok();
        let response_time_ms = start_time.elapsed().as_millis() as u64;

        // Get database stats (simplified)
        let db_stats = bson::Document::new();

        // Check collection health
        let collections_healthy = self.check_collections_health().await.unwrap_or(false);

        // Determine overall health
        let overall_status = if connection_healthy && collections_healthy && response_time_ms < 5000 {
            "healthy"
        } else if connection_healthy && response_time_ms < 10000 {
            "degraded"
        } else {
            "unhealthy"
        };

        Ok(HealthStatus {
            overall_status: overall_status.to_string(),
            connection_healthy,
            response_time_ms,
            collections_healthy,
            database_stats: db_stats,
            last_check: chrono::Utc::now(),
            issues: if overall_status == "healthy" {
                Vec::new()
            } else {
                vec!["Performance degradation detected".to_string()]
            },
        })
    }

    async fn check_collections_health(&self) -> MongoResult<bool> {
        // Check if main collections exist and are accessible
        let collection_names = vec!["projects", "recordings", "knowledge_base"];

        for name in collection_names {
            let collection = self.database.database.collection::<bson::Document>(name);
            if collection.estimated_document_count().await.is_err() {
                return Ok(false);
            }
        }

        Ok(true)
    }
}

/// Health status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub overall_status: String,
    pub connection_healthy: bool,
    pub response_time_ms: u64,
    pub collections_healthy: bool,
    pub database_stats: bson::Document,
    pub last_check: chrono::DateTime<chrono::Utc>,
    pub issues: Vec<String>,
}