//! # Causal Desktop Application - Tauri Backend
//!
//! This is the Rust backend for the Causal desktop application, built with Tauri v2.
//! Causal is a real-time AI-powered transcription application that captures audio,
//! transcribes it using AssemblyAI's Universal Streaming API, and enhances the
//! transcription using Claude AI.
//!
//! ## Architecture Overview
//!
//! The backend is organized into several key modules:
//!
//! - [`database`] - SQLite database operations for projects and recordings
//! - [`transcription`] - Real-time audio capture and transcription processing
//! - [`logging`] - Structured logging and metrics collection
//! - [`error`] - Centralized error handling types
//!
//! ## Key Features
//!
//! - **Real-time Audio Processing**: High-performance audio capture with buffer pooling
//! - **Streaming Transcription**: WebSocket-based streaming to AssemblyAI
//! - **AI Enhancement**: Text refinement using Claude AI
//! - **Project Management**: Multi-project support with SQLite storage
//! - **Performance Monitoring**: Comprehensive metrics and logging
//!
//! ## Usage
//!
//! The application is launched via the [`run()`] function, which initializes all
//! components and starts the Tauri application loop.

mod database;
mod error;
mod logging;
mod transcription;

use database::Database;
// Note: Error types available for future use
// use error::{CausalError, CausalResult};
use logging::{MetricsCollector, MetricsSnapshot, LogEntry, LogFileInfo, LoggingStats};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use transcription::commands::AppState;

/// Global logging state shared across the application.
///
/// This structure manages the application's logging configuration and metrics collection.
/// It is stored as Tauri managed state and can be accessed from any command handler.
///
/// # Fields
///
/// - `log_dir`: Directory where log files are stored
/// - `metrics`: Collector for application performance metrics
///
/// # Thread Safety
///
/// This struct is wrapped in a `Mutex` when used as Tauri state to ensure thread-safe access.
pub struct LoggingState {
    /// Directory where log files are stored
    pub log_dir: PathBuf,
    /// Metrics collector for application performance monitoring
    pub metrics: MetricsCollector,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Logging and Metrics Commands

#[tauri::command]
fn get_metrics(logging_state: State<Mutex<LoggingState>>) -> Result<MetricsSnapshot, String> {
    let state = logging_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(state.metrics.snapshot())
}

#[tauri::command]
fn reset_metrics(logging_state: State<Mutex<LoggingState>>) -> Result<String, String> {
    let state = logging_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    state.metrics.reset();
    Ok("Metrics reset successfully".to_string())
}

#[tauri::command]
fn get_recent_logs(
    app: AppHandle,
    logging_state: State<Mutex<LoggingState>>,
    limit: usize,
) -> Result<Vec<LogEntry>, String> {
    let state = logging_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let result = logging::commands::get_recent_logs(&state.log_dir, limit)?;

    // Emit event for log data refresh
    if let Err(e) = app.emit("logs_refreshed", serde_json::json!({"count": result.len()})) {
        tracing::error!("Failed to emit logs_refreshed event: {}", e);
    }

    Ok(result)
}

#[tauri::command]
fn get_logging_stats(logging_state: State<Mutex<LoggingState>>) -> Result<LoggingStats, String> {
    let state = logging_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    logging::commands::get_logging_stats(&state.log_dir)
}

#[tauri::command]
fn list_log_files(logging_state: State<Mutex<LoggingState>>) -> Result<Vec<LogFileInfo>, String> {
    let state = logging_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    logging::commands::list_log_files(&state.log_dir)
}

#[tauri::command]
fn export_logs(
    logging_state: State<Mutex<LoggingState>>,
    output_path: String,
) -> Result<String, String> {
    let state = logging_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let output = PathBuf::from(output_path);
    logging::commands::export_logs(&state.log_dir, &output)
}

#[tauri::command]
fn clear_old_logs(logging_state: State<Mutex<LoggingState>>) -> Result<String, String> {
    let state = logging_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    logging::commands::clear_old_logs(&state.log_dir)
}

#[tauri::command]
fn clear_all_logs(logging_state: State<Mutex<LoggingState>>) -> Result<String, String> {
    let state = logging_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    logging::commands::clear_all_logs(&state.log_dir)
}

/// Main entry point for the Causal desktop application.
///
/// This function initializes all core components and starts the Tauri application:
///
/// 1. **Logging System**: Configures structured logging with file rotation
/// 2. **Database**: Sets up SQLite with WAL mode and performance optimizations
/// 3. **Tauri Application**: Registers all commands and starts the event loop
///
/// # Panics
///
/// This function will exit the process with code 1 if critical components fail to initialize:
/// - Logging system initialization failure
/// - Database initialization failure
/// - Tauri application startup failure
///
/// # Examples
///
/// ```rust,no_run
/// // This is typically called from main.rs
/// causal_lib::run();
/// ```
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging with fallback directory
    // Use platform-appropriate fallback until we have app handle
    let fallback_log_dir = logging::get_default_log_dir();
    let log_config = logging::LoggingConfig::default()
        .with_log_dir(fallback_log_dir.clone());

    if let Err(e) = logging::init_logging(log_config) {
        eprintln!("Critical error: Failed to initialize logging: {}", e);
        eprintln!("This error prevents the application from starting.");
        std::process::exit(1);
    }

    tracing::info!("Causal application starting");

    let database = match Database::new() {
        Ok(db) => db,
        Err(e) => {
            tracing::error!("Critical error: Failed to initialize database: {}", e);
            eprintln!("Critical error: Failed to initialize database: {}", e);
            eprintln!("This error prevents the application from starting.");
            std::process::exit(1);
        }
    };
    let metrics = MetricsCollector::new();
    let logging_state = Mutex::new(LoggingState {
        log_dir: fallback_log_dir,
        metrics,
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Log the actual Tauri-provided log directory for reference
            if let Ok(tauri_log_dir) = app.path().app_log_dir() {
                tracing::info!(
                    tauri_log_dir = %tauri_log_dir.display(),
                    "Tauri log directory available"
                );
            }

            Ok(())
        })
        .manage(AppState::default())
        .manage(database)
        .manage(logging_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            transcription::list_audio_devices,
            transcription::start_transcription,
            transcription::stop_transcription,
            transcription::get_transcription_status,
            transcription::summarize_transcription,
            transcription::refine_transcript,
            // Database commands - Projects
            database::create_project,
            database::list_projects,
            database::get_project,
            database::update_project,
            database::delete_project,
            // Database commands - Recordings
            database::create_recording,
            database::list_recordings,
            database::get_recording,
            database::update_recording_name,
            database::delete_recording,
            database::export_recording,
            database::get_database_stats,
            database::generate_recording_summary,
            // Recording session commands
            transcription::save_recording,
            transcription::get_current_session,
            transcription::set_current_project,
            transcription::get_current_project,
            transcription::clear_current_session,
            // Logging and Metrics commands
            get_metrics,
            reset_metrics,
            get_recent_logs,
            get_logging_stats,
            list_log_files,
            export_logs,
            clear_old_logs,
            clear_all_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
