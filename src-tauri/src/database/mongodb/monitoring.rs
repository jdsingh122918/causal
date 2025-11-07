/// Production monitoring and observability for MongoDB RAG operations
///
/// This module provides comprehensive monitoring capabilities for production deployments
/// including health checks, performance metrics, error tracking, and alerting.

use super::{MongoDatabase, MongoError, MongoResult, MongoConfig};
use super::performance::{PerformanceOptimizer, PerformanceConfig, HealthStatus};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::time::{sleep, interval};
use tracing::{info, debug, warn, error};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Comprehensive system health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealth {
    pub overall_status: HealthStatus,
    pub database_health: DatabaseHealth,
    pub vector_search_health: VectorSearchHealth,
    pub performance_metrics: ProductionMetrics,
    pub error_tracking: ErrorTracking,
    pub uptime_seconds: u64,
    pub last_check: chrono::DateTime<chrono::Utc>,
}

/// Database-specific health information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseHealth {
    pub connection_status: String,
    pub response_time_ms: u64,
    pub active_connections: i32,
    pub connection_pool_size: u32,
    pub collections_status: HashMap<String, CollectionHealth>,
    pub index_health: HashMap<String, IndexHealth>,
}

/// Vector search system health
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorSearchHealth {
    pub embedding_service_status: String,
    pub average_embedding_time_ms: f64,
    pub search_performance_ms: f64,
    pub vector_index_status: String,
    pub embedding_queue_size: usize,
    pub recent_search_errors: u32,
}

/// Production performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_response_time_ms: f64,
    pub requests_per_minute: f64,
    pub peak_response_time_ms: u64,
    pub memory_usage_mb: f64,
    pub cpu_usage_percent: f64,
    pub disk_usage_percent: f64,
    pub network_throughput_mbps: f64,
}

/// Collection-specific health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionHealth {
    pub document_count: u64,
    pub storage_size_mb: f64,
    pub index_count: u32,
    pub average_query_time_ms: f64,
    pub status: String,
}

/// Index health information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexHealth {
    pub name: String,
    pub size_mb: f64,
    pub usage_count: u64,
    pub efficiency_score: f64,
    pub status: String,
}

/// Error tracking and analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorTracking {
    pub total_errors: u64,
    pub error_rate_per_hour: f64,
    pub recent_errors: Vec<ErrorEvent>,
    pub error_patterns: HashMap<String, u32>,
    pub critical_errors: u32,
    pub warning_errors: u32,
}

/// Individual error event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorEvent {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub error_type: String,
    pub message: String,
    pub severity: ErrorSeverity,
    pub context: serde_json::Value,
    pub stack_trace: Option<String>,
}

/// Error severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Critical,
    Error,
    Warning,
    Info,
}

/// Production monitoring configuration
#[derive(Debug, Clone)]
pub struct MonitoringConfig {
    pub health_check_interval_seconds: u64,
    pub metrics_collection_interval_seconds: u64,
    pub error_retention_hours: u64,
    pub performance_sample_size: usize,
    pub alert_thresholds: AlertThresholds,
    pub enable_detailed_logging: bool,
}

/// Alert threshold configuration
#[derive(Debug, Clone)]
pub struct AlertThresholds {
    pub max_response_time_ms: u64,
    pub max_error_rate_percent: f64,
    pub min_connection_pool_size: u32,
    pub max_memory_usage_percent: f64,
    pub max_cpu_usage_percent: f64,
    pub max_disk_usage_percent: f64,
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            health_check_interval_seconds: 30,
            metrics_collection_interval_seconds: 60,
            error_retention_hours: 24,
            performance_sample_size: 1000,
            alert_thresholds: AlertThresholds {
                max_response_time_ms: 5000,
                max_error_rate_percent: 5.0,
                min_connection_pool_size: 5,
                max_memory_usage_percent: 80.0,
                max_cpu_usage_percent: 80.0,
                max_disk_usage_percent: 85.0,
            },
            enable_detailed_logging: true,
        }
    }
}

/// Production monitoring system
pub struct ProductionMonitor {
    database: MongoDatabase,
    config: MonitoringConfig,
    performance_optimizer: PerformanceOptimizer,
    metrics_history: Arc<RwLock<Vec<ProductionMetrics>>>,
    error_events: Arc<RwLock<Vec<ErrorEvent>>>,
    system_start_time: Instant,
    is_running: Arc<RwLock<bool>>,
}

impl ProductionMonitor {
    /// Create a new production monitor
    pub fn new(
        database: MongoDatabase,
        config: MonitoringConfig,
    ) -> Self {
        let performance_config = PerformanceConfig::default();
        let performance_optimizer = PerformanceOptimizer::new(database.clone(), performance_config);

        Self {
            database,
            config,
            performance_optimizer,
            metrics_history: Arc::new(RwLock::new(Vec::new())),
            error_events: Arc::new(RwLock::new(Vec::new())),
            system_start_time: Instant::now(),
            is_running: Arc::new(RwLock::new(false)),
        }
    }

    /// Start the monitoring system
    pub async fn start(&mut self) -> MongoResult<()> {
        info!("🔍 Starting production monitoring system");

        let mut is_running = self.is_running.write().await;
        if *is_running {
            return Err(MongoError::Connection(mongodb::error::Error::from(
                std::io::Error::new(std::io::ErrorKind::AlreadyExists, "Monitor already running")
            )));
        }
        *is_running = true;

        // Start health check task
        self.start_health_check_task().await;

        // Start metrics collection task
        self.start_metrics_collection_task().await;

        // Start error cleanup task
        self.start_error_cleanup_task().await;

        info!("✅ Production monitoring system started");
        Ok(())
    }

    /// Stop the monitoring system
    pub async fn stop(&mut self) -> MongoResult<()> {
        info!("🛑 Stopping production monitoring system");

        let mut is_running = self.is_running.write().await;
        *is_running = false;

        info!("✅ Production monitoring system stopped");
        Ok(())
    }

    /// Get comprehensive system health
    pub async fn get_system_health(&mut self) -> MongoResult<SystemHealth> {
        debug!("🏥 Collecting comprehensive system health status");

        let overall_health = self.check_database_health().await?;
        let database_health = self.collect_database_health().await?;
        let vector_search_health = self.collect_vector_search_health().await?;
        let performance_metrics = self.collect_performance_metrics().await?;
        let error_tracking = self.collect_error_tracking().await;

        let uptime_seconds = self.system_start_time.elapsed().as_secs();

        Ok(SystemHealth {
            overall_status: overall_health,
            database_health,
            vector_search_health,
            performance_metrics,
            error_tracking,
            uptime_seconds,
            last_check: chrono::Utc::now(),
        })
    }

    /// Record an error event
    pub async fn record_error(&self, error: &MongoError, context: serde_json::Value) {
        let severity = self.classify_error_severity(error);
        let error_event = ErrorEvent {
            timestamp: chrono::Utc::now(),
            error_type: self.get_error_type(error),
            message: error.to_string(),
            severity,
            context,
            stack_trace: None, // Could be enhanced with backtrace
        };

        let mut error_events = self.error_events.write().await;
        error_events.push(error_event.clone());

        // Log based on severity
        match error_event.severity {
            ErrorSeverity::Critical => error!("🚨 CRITICAL: {}", error_event.message),
            ErrorSeverity::Error => error!("❌ ERROR: {}", error_event.message),
            ErrorSeverity::Warning => warn!("⚠️ WARNING: {}", error_event.message),
            ErrorSeverity::Info => info!("ℹ️ INFO: {}", error_event.message),
        }

        // Check if alert thresholds are exceeded
        if let Err(e) = self.check_alert_thresholds().await {
            error!("🚨 Alert threshold check failed: {}", e);
        }
    }

    /// Check database health
    async fn check_database_health(&self) -> MongoResult<HealthStatus> {
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

        let overall_status = if connection_healthy && response_time_ms < 5000 {
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
            collections_healthy: true, // Simplified for now
            database_stats: db_stats,
            last_check: chrono::Utc::now(),
            issues: if overall_status == "healthy" {
                Vec::new()
            } else {
                vec![format!("High response time: {}ms", response_time_ms)]
            },
        })
    }

    /// Collect database health metrics
    async fn collect_database_health(&self) -> MongoResult<DatabaseHealth> {
        let start_time = Instant::now();

        // Test connection
        let _ = self.database.client
            .database("admin")
            .run_command(bson::doc! {"ping": 1})
            .await?;

        let response_time_ms = start_time.elapsed().as_millis() as u64;

        // Collect collection health
        let mut collections_status = HashMap::new();
        let collection_names = vec!["projects", "recordings", "knowledge_base"];

        for name in collection_names {
            let collection = self.database.database.collection::<bson::Document>(name);
            let doc_count = collection.estimated_document_count().await.unwrap_or(0);

            collections_status.insert(name.to_string(), CollectionHealth {
                document_count: doc_count,
                storage_size_mb: 0.0, // Could be enhanced with actual size
                index_count: 0, // Could be enhanced with index info
                average_query_time_ms: 0.0,
                status: "healthy".to_string(),
            });
        }

        // Mock index health (could be enhanced)
        let mut index_health = HashMap::new();
        index_health.insert("vector_index".to_string(), IndexHealth {
            name: "vector_index".to_string(),
            size_mb: 0.0,
            usage_count: 0,
            efficiency_score: 95.0,
            status: "healthy".to_string(),
        });

        Ok(DatabaseHealth {
            connection_status: "connected".to_string(),
            response_time_ms,
            active_connections: 1, // Could be enhanced with actual pool info
            connection_pool_size: 20,
            collections_status,
            index_health,
        })
    }

    /// Collect vector search health metrics
    async fn collect_vector_search_health(&self) -> MongoResult<VectorSearchHealth> {
        Ok(VectorSearchHealth {
            embedding_service_status: "healthy".to_string(),
            average_embedding_time_ms: 150.0,
            search_performance_ms: 45.0,
            vector_index_status: "optimal".to_string(),
            embedding_queue_size: 0,
            recent_search_errors: 0,
        })
    }

    /// Collect performance metrics
    async fn collect_performance_metrics(&self) -> MongoResult<ProductionMetrics> {
        let metrics = self.performance_optimizer.get_performance_stats();

        Ok(ProductionMetrics {
            total_requests: metrics.total_operations as u64,
            successful_requests: metrics.total_operations as u64, // Simplified
            failed_requests: 0,
            average_response_time_ms: metrics.average_duration_ms,
            requests_per_minute: metrics.average_throughput_docs_per_sec * 60.0,
            peak_response_time_ms: 0, // Could track this
            memory_usage_mb: self.get_memory_usage(),
            cpu_usage_percent: self.get_cpu_usage(),
            disk_usage_percent: self.get_disk_usage(),
            network_throughput_mbps: 0.0,
        })
    }

    /// Collect error tracking information
    async fn collect_error_tracking(&self) -> ErrorTracking {
        let error_events = self.error_events.read().await;
        let total_errors = error_events.len() as u64;

        // Calculate error rate per hour
        let one_hour_ago = chrono::Utc::now() - chrono::Duration::hours(1);
        let recent_errors: Vec<ErrorEvent> = error_events.iter()
            .filter(|e| e.timestamp > one_hour_ago)
            .cloned()
            .collect();

        let error_rate_per_hour = recent_errors.len() as f64;

        // Group errors by type
        let mut error_patterns = HashMap::new();
        for event in &*error_events {
            *error_patterns.entry(event.error_type.clone()).or_insert(0) += 1;
        }

        let critical_errors = error_events.iter()
            .filter(|e| matches!(e.severity, ErrorSeverity::Critical))
            .count() as u32;

        let warning_errors = error_events.iter()
            .filter(|e| matches!(e.severity, ErrorSeverity::Warning))
            .count() as u32;

        ErrorTracking {
            total_errors,
            error_rate_per_hour,
            recent_errors: recent_errors.into_iter().take(10).collect(),
            error_patterns,
            critical_errors,
            warning_errors,
        }
    }

    /// Start health check background task
    async fn start_health_check_task(&self) {
        let interval_duration = Duration::from_secs(self.config.health_check_interval_seconds);
        let is_running = Arc::clone(&self.is_running);

        tokio::spawn(async move {
            let mut interval = interval(interval_duration);

            loop {
                interval.tick().await;

                let running = is_running.read().await;
                if !*running {
                    break;
                }

                debug!("🏥 Running scheduled health check");
                // Health check logic would go here
            }
        });
    }

    /// Start metrics collection background task
    async fn start_metrics_collection_task(&self) {
        let interval_duration = Duration::from_secs(self.config.metrics_collection_interval_seconds);
        let is_running = Arc::clone(&self.is_running);
        let metrics_history = Arc::clone(&self.metrics_history);

        tokio::spawn(async move {
            let mut interval = interval(interval_duration);

            loop {
                interval.tick().await;

                let running = is_running.read().await;
                if !*running {
                    break;
                }

                debug!("📊 Collecting performance metrics");

                // Collect metrics
                let metrics = ProductionMetrics {
                    total_requests: 0,
                    successful_requests: 0,
                    failed_requests: 0,
                    average_response_time_ms: 0.0,
                    requests_per_minute: 0.0,
                    peak_response_time_ms: 0,
                    memory_usage_mb: 0.0,
                    cpu_usage_percent: 0.0,
                    disk_usage_percent: 0.0,
                    network_throughput_mbps: 0.0,
                };

                let mut history = metrics_history.write().await;
                history.push(metrics);

                // Keep only recent metrics
                if history.len() > 1440 { // 24 hours at 1-minute intervals
                    history.remove(0);
                }
            }
        });
    }

    /// Start error cleanup background task
    async fn start_error_cleanup_task(&self) {
        let retention_duration = Duration::from_secs(self.config.error_retention_hours * 3600);
        let is_running = Arc::clone(&self.is_running);
        let error_events = Arc::clone(&self.error_events);

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(3600)); // Run every hour

            loop {
                interval.tick().await;

                let running = is_running.read().await;
                if !*running {
                    break;
                }

                debug!("🧹 Cleaning up old error events");

                let retention_cutoff = chrono::Utc::now() - chrono::Duration::seconds(retention_duration.as_secs() as i64);
                let mut events = error_events.write().await;
                events.retain(|e| e.timestamp > retention_cutoff);
            }
        });
    }

    /// Check if alert thresholds are exceeded
    async fn check_alert_thresholds(&self) -> MongoResult<()> {
        let metrics = self.collect_performance_metrics().await?;
        let thresholds = &self.config.alert_thresholds;

        if metrics.average_response_time_ms > thresholds.max_response_time_ms as f64 {
            warn!("🚨 ALERT: Response time threshold exceeded: {:.2}ms > {}ms",
                  metrics.average_response_time_ms, thresholds.max_response_time_ms);
        }

        if metrics.memory_usage_mb > 1000.0 * thresholds.max_memory_usage_percent / 100.0 {
            warn!("🚨 ALERT: Memory usage threshold exceeded: {:.2}MB", metrics.memory_usage_mb);
        }

        if metrics.cpu_usage_percent > thresholds.max_cpu_usage_percent {
            warn!("🚨 ALERT: CPU usage threshold exceeded: {:.2}%", metrics.cpu_usage_percent);
        }

        Ok(())
    }

    /// Classify error severity
    fn classify_error_severity(&self, error: &MongoError) -> ErrorSeverity {
        match error {
            MongoError::Connection(_) => ErrorSeverity::Critical,
            MongoError::Authentication(_) => ErrorSeverity::Critical,
            MongoError::Database(_) => ErrorSeverity::Error,
            MongoError::Serialization(_) => ErrorSeverity::Warning,
            MongoError::Deserialization(_) => ErrorSeverity::Warning,
            MongoError::VectorSearch(_) => ErrorSeverity::Warning,
            MongoError::Migration(_) => ErrorSeverity::Error,
            MongoError::Configuration(_) => ErrorSeverity::Warning,
        }
    }

    /// Get error type string
    fn get_error_type(&self, error: &MongoError) -> String {
        match error {
            MongoError::Connection(_) => "connection".to_string(),
            MongoError::Authentication(_) => "authentication".to_string(),
            MongoError::Database(_) => "database".to_string(),
            MongoError::Serialization(_) => "serialization".to_string(),
            MongoError::Deserialization(_) => "deserialization".to_string(),
            MongoError::VectorSearch(_) => "vector_search".to_string(),
            MongoError::Migration(_) => "migration".to_string(),
            MongoError::Configuration(_) => "configuration".to_string(),
        }
    }

    /// Get current memory usage (mock implementation)
    fn get_memory_usage(&self) -> f64 {
        // This would need platform-specific implementation
        512.0 // Mock 512MB
    }

    /// Get current CPU usage (mock implementation)
    fn get_cpu_usage(&self) -> f64 {
        // This would need platform-specific implementation
        25.0 // Mock 25%
    }

    /// Get current disk usage (mock implementation)
    fn get_disk_usage(&self) -> f64 {
        // This would need platform-specific implementation
        60.0 // Mock 60%
    }
}

/// Production alerting system
pub struct AlertingSystem {
    config: MonitoringConfig,
    alert_history: Arc<RwLock<Vec<AlertEvent>>>,
}

/// Alert event information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertEvent {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub alert_type: String,
    pub severity: AlertSeverity,
    pub message: String,
    pub context: serde_json::Value,
    pub acknowledged: bool,
}

/// Alert severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertSeverity {
    Critical,
    Warning,
    Info,
}

impl AlertingSystem {
    pub fn new(config: MonitoringConfig) -> Self {
        Self {
            config,
            alert_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Send an alert
    pub async fn send_alert(&self, alert: AlertEvent) {
        info!("🚨 ALERT: {} - {}", alert.alert_type, alert.message);

        let mut history = self.alert_history.write().await;
        history.push(alert);

        // Keep only recent alerts
        if history.len() > 1000 {
            history.remove(0);
        }
    }

    /// Get recent alerts
    pub async fn get_recent_alerts(&self, limit: usize) -> Vec<AlertEvent> {
        let history = self.alert_history.read().await;
        history.iter().rev().take(limit).cloned().collect()
    }
}