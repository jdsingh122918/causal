mod config;
mod privacy;
pub mod metrics;
pub mod commands;

#[allow(unused_imports)] // PrivacyMode used in tests and public API
pub use config::{LoggingConfig, PrivacyMode};
pub use metrics::{MetricsCollector, MetricsSnapshot};
#[allow(unused_imports)] // TimedOperation used in instrumentation
pub use metrics::TimedOperation;
pub use commands::{LogEntry, LogFileInfo, LoggingStats};

use tracing_subscriber::{fmt, EnvFilter};
use tracing_appender::rolling::{RollingFileAppender, Rotation};

/// Initialize the logging system with the provided configuration
pub fn init_logging(config: LoggingConfig) -> Result<(), String> {
    // Ensure log directory exists
    std::fs::create_dir_all(&config.log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;

    // Create rolling file appender (daily rotation)
    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,
        &config.log_dir,
        "causal.log"
    );

    // Use non-blocking appender
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    std::mem::forget(_guard);  // Keep guard alive for app lifetime

    // Build env filter
    let env_filter = create_env_filter(&config);

    // Configure subscriber based on environment
    if cfg!(debug_assertions) {
        // Development: pretty console output + file logging
        fmt()
            .with_env_filter(env_filter)
            .with_writer(non_blocking)
            .with_file(true)
            .with_line_number(true)
            .with_thread_ids(false)
            .pretty()
            .init();
    } else {
        // Production: JSON file logging only
        fmt()
            .with_env_filter(env_filter)
            .with_writer(non_blocking)
            .json()
            .with_current_span(true)
            .with_span_list(true)
            .with_thread_ids(true)
            .with_file(true)
            .with_line_number(true)
            .init();
    }

    tracing::info!(
        log_dir = %config.log_dir.display(),
        console_enabled = cfg!(debug_assertions),
        file_enabled = true,
        json_enabled = !cfg!(debug_assertions),
        privacy_mode = ?config.privacy_mode,
        "Logging initialized"
    );

    Ok(())
}

/// Create the environment filter for log levels
fn create_env_filter(config: &LoggingConfig) -> EnvFilter {
    // Try to read from environment first
    EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        let level_str = match config.max_level {
            tracing::Level::TRACE => "trace",
            tracing::Level::DEBUG => "debug",
            tracing::Level::INFO => "info",
            tracing::Level::WARN => "warn",
            tracing::Level::ERROR => "error",
        };

        // Module-specific filtering
        // Set root level and then override for specific modules
        EnvFilter::new(format!(
            "{},\
            causal_lib=debug,\
            transcription=debug,\
            database=info,\
            hyper=info,\
            tokio=info,\
            tungstenite=info,\
            reqwest=info",
            level_str
        ))
    })
}

/// Get the default log directory path
/// This should be called with a Tauri AppHandle to get the proper platform-specific path
pub fn get_default_log_dir() -> std::path::PathBuf {
    // This is a fallback - in production, use Tauri's app_log_dir()
    if cfg!(target_os = "macos") {
        dirs::home_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("Library/Application Support/dev.fermatsolutions.causal/logs")
    } else if cfg!(target_os = "windows") {
        dirs::config_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("dev.fermatsolutions.causal")
            .join("logs")
    } else {
        // Linux
        dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("dev.fermatsolutions.causal")
            .join("logs")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = LoggingConfig::default();

        // In debug mode
        #[cfg(debug_assertions)]
        {
            assert_eq!(config.max_level, tracing::Level::DEBUG);
            assert!(config.enable_console);
            assert!(!config.enable_json);
            assert_eq!(config.privacy_mode, PrivacyMode::Full);
        }

        // In release mode
        #[cfg(not(debug_assertions))]
        {
            assert_eq!(config.max_level, tracing::Level::INFO);
            assert!(!config.enable_console);
            assert!(config.enable_json);
            assert_eq!(config.privacy_mode, PrivacyMode::Redacted);
        }
    }
}
