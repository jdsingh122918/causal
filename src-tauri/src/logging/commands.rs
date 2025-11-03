use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Log entry from file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
    pub fields: Option<String>,
}

/// Log file information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogFileInfo {
    pub path: String,
    pub size_bytes: u64,
    pub modified: String,
    pub is_current: bool,
}

/// Statistics about the logging system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingStats {
    pub log_directory: String,
    pub current_log_file: String,
    pub total_size_bytes: u64,
    pub file_count: usize,
    pub oldest_log_date: Option<String>,
}

/// Get recent log entries
pub fn get_recent_logs(log_dir: &PathBuf, limit: usize) -> Result<Vec<LogEntry>, String> {
    let current_log = log_dir.join("causal.log");

    if !current_log.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&current_log)
        .map_err(|e| format!("Failed to read log file: {}", e))?;

    let lines: Vec<&str> = content.lines().collect();
    let start_idx = if lines.len() > limit {
        lines.len() - limit
    } else {
        0
    };

    let entries: Vec<LogEntry> = lines[start_idx..]
        .iter()
        .filter_map(|line| {
            // Try to parse as JSON (production mode)
            if line.starts_with('{') {
                if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
                    return Some(LogEntry {
                        timestamp: json_value.get("timestamp")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        level: json_value.get("level")
                            .and_then(|v| v.as_str())
                            .unwrap_or("INFO")
                            .to_string(),
                        message: json_value.get("message")
                            .or_else(|| json_value.get("fields")?.get("message"))
                            .and_then(|v| v.as_str())
                            .unwrap_or(line)
                            .to_string(),
                        fields: json_value.get("fields")
                            .and_then(|v| serde_json::to_string(v).ok()),
                    });
                }
            }

            // Parse as plain text (development mode)
            // Format: "2024-01-01 12:00:00 LEVEL message"
            let parts: Vec<&str> = line.splitn(4, ' ').collect();
            if parts.len() >= 3 {
                Some(LogEntry {
                    timestamp: format!("{} {}", parts.get(0).unwrap_or(&""), parts.get(1).unwrap_or(&"")),
                    level: parts.get(2).unwrap_or(&"INFO").to_string(),
                    message: parts.get(3).unwrap_or(&line).to_string(),
                    fields: None,
                })
            } else {
                Some(LogEntry {
                    timestamp: String::new(),
                    level: "INFO".to_string(),
                    message: line.to_string(),
                    fields: None,
                })
            }
        })
        .collect();

    Ok(entries)
}

/// Get logging statistics
pub fn get_logging_stats(log_dir: &PathBuf) -> Result<LoggingStats, String> {
    if !log_dir.exists() {
        return Err("Log directory does not exist".to_string());
    }

    let mut total_size = 0u64;
    let mut file_count = 0usize;
    let mut oldest_date: Option<String> = None;

    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "log" || path.to_string_lossy().contains("causal.log")) {
                if let Ok(metadata) = fs::metadata(&path) {
                    total_size += metadata.len();
                    file_count += 1;

                    // Extract date from filename if it's an archived log
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        if filename.starts_with("causal.log.") {
                            let date_str = filename.trim_start_matches("causal.log.");
                            if oldest_date.is_none() || Some(date_str) < oldest_date.as_deref() {
                                oldest_date = Some(date_str.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(LoggingStats {
        log_directory: log_dir.to_string_lossy().to_string(),
        current_log_file: log_dir.join("causal.log").to_string_lossy().to_string(),
        total_size_bytes: total_size,
        file_count,
        oldest_log_date: oldest_date,
    })
}

/// List all log files
pub fn list_log_files(log_dir: &PathBuf) -> Result<Vec<LogFileInfo>, String> {
    if !log_dir.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "log" || path.to_string_lossy().contains("causal.log")) {
                if let Ok(metadata) = fs::metadata(&path) {
                    let is_current = path.file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n == "causal.log")
                        .unwrap_or(false);

                    files.push(LogFileInfo {
                        path: path.to_string_lossy().to_string(),
                        size_bytes: metadata.len(),
                        modified: format!("{:?}", metadata.modified().ok()),
                        is_current,
                    });
                }
            }
        }
    }

    // Sort by filename (current first, then by date descending)
    files.sort_by(|a, b| {
        if a.is_current {
            std::cmp::Ordering::Less
        } else if b.is_current {
            std::cmp::Ordering::Greater
        } else {
            b.path.cmp(&a.path)
        }
    });

    Ok(files)
}

/// Export logs to a file
pub fn export_logs(log_dir: &PathBuf, output_path: &PathBuf) -> Result<String, String> {
    let current_log = log_dir.join("causal.log");

    if !current_log.exists() {
        return Err("No log file found".to_string());
    }

    fs::copy(&current_log, output_path)
        .map_err(|e| format!("Failed to export logs: {}", e))?;

    Ok(format!("Logs exported to {}", output_path.display()))
}

/// Clear old log files (keep current)
pub fn clear_old_logs(log_dir: &PathBuf) -> Result<String, String> {
    if !log_dir.exists() {
        return Ok("No log directory found".to_string());
    }

    let mut deleted_count = 0;
    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                let is_current = path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n == "causal.log")
                    .unwrap_or(false);

                // Only delete archived logs, keep current
                if !is_current && path.to_string_lossy().contains("causal.log") {
                    if fs::remove_file(&path).is_ok() {
                        deleted_count += 1;
                    }
                }
            }
        }
    }

    Ok(format!("Cleared {} old log file(s)", deleted_count))
}

/// Clear all logs including current
pub fn clear_all_logs(log_dir: &PathBuf) -> Result<String, String> {
    if !log_dir.exists() {
        return Ok("No log directory found".to_string());
    }

    let mut deleted_count = 0;
    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.to_string_lossy().contains("causal.log") {
                if fs::remove_file(&path).is_ok() {
                    deleted_count += 1;
                }
            }
        }
    }

    Ok(format!("Cleared {} log file(s)", deleted_count))
}
