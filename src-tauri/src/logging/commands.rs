use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use regex::Regex;

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
pub fn get_recent_logs(log_dir: &Path, limit: usize) -> Result<Vec<LogEntry>, String> {
    let current_log = log_dir.join("causal.log");

    // If current log doesn't exist, try to find the most recent dated log file
    let log_file = if current_log.exists() {
        current_log
    } else {
        // Find the most recent log file (causal.log.YYYY-MM-DD)
        let entries = fs::read_dir(log_dir)
            .map_err(|e| format!("Failed to read log directory: {}", e))?;

        let mut log_files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                p.is_file() &&
                p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with("causal.log"))
                    .unwrap_or(false)
            })
            .collect();

        if log_files.is_empty() {
            return Ok(Vec::new());
        }

        // Sort by filename (most recent date last)
        log_files.sort();
        log_files.pop().expect("log_files should not be empty - checked above")
    };

    let content = fs::read_to_string(&log_file)
        .map_err(|e| format!("Failed to read log file: {}", e))?;

    let lines: Vec<&str> = content.lines().collect();
    let start_idx = if lines.len() > limit {
        lines.len() - limit
    } else {
        0
    };

    // Helper function to strip ANSI escape codes
    let strip_ansi = |s: &str| -> String {
        let re = Regex::new(r"\x1b\[[0-9;]*m").unwrap();
        re.replace_all(s, "").to_string()
    };

    let entries: Vec<LogEntry> = lines[start_idx..]
        .iter()
        .filter_map(|line| {
            if line.trim().is_empty() {
                return None;
            }

            // Strip ANSI codes for parsing
            let clean_line = strip_ansi(line);

            // Try to parse as JSON (production mode)
            if clean_line.trim().starts_with('{') {
                if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&clean_line) {
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
                            .unwrap_or(&clean_line)
                            .to_string(),
                        fields: json_value.get("fields")
                            .and_then(|v| serde_json::to_string(v).ok()),
                    });
                }
            }

            // Parse as structured text (development mode with tracing-subscriber)
            // Format: "  YYYY-MM-DDTHH:MM:SS.SSSSSSZ LEVEL module: message"
            let trimmed = clean_line.trim();

            // Try to extract timestamp, level, and message
            if let Some(first_space) = trimmed.find(' ') {
                let timestamp = trimmed[..first_space].trim();
                let rest = trimmed[first_space..].trim();

                if let Some(second_space) = rest.find(' ') {
                    let level = rest[..second_space].trim().to_uppercase();
                    let message = rest[second_space..].trim();

                    return Some(LogEntry {
                        timestamp: timestamp.to_string(),
                        level,
                        message: message.to_string(),
                        fields: None,
                    });
                }
            }

            // Fallback: treat entire line as message
            Some(LogEntry {
                timestamp: String::new(),
                level: "INFO".to_string(),
                message: clean_line,
                fields: None,
            })
        })
        .collect();

    Ok(entries)
}

/// Get logging statistics
pub fn get_logging_stats(log_dir: &Path) -> Result<LoggingStats, String> {
    if !log_dir.exists() {
        return Err("Log directory does not exist".to_string());
    }

    let mut total_size = 0u64;
    let mut file_count = 0usize;
    let mut oldest_date: Option<String> = None;

    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().is_some_and(|ext| ext == "log" || path.to_string_lossy().contains("causal.log")) {
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

    Ok(LoggingStats {
        log_directory: log_dir.to_string_lossy().to_string(),
        current_log_file: log_dir.join("causal.log").to_string_lossy().to_string(),
        total_size_bytes: total_size,
        file_count,
        oldest_log_date: oldest_date,
    })
}

/// List all log files
pub fn list_log_files(log_dir: &Path) -> Result<Vec<LogFileInfo>, String> {
    if !log_dir.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().is_some_and(|ext| ext == "log" || path.to_string_lossy().contains("causal.log")) {
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
pub fn export_logs(log_dir: &Path, output_path: &Path) -> Result<String, String> {
    let current_log = log_dir.join("causal.log");

    if !current_log.exists() {
        return Err("No log file found".to_string());
    }

    fs::copy(&current_log, output_path)
        .map_err(|e| format!("Failed to export logs: {}", e))?;

    Ok(format!("Logs exported to {}", output_path.display()))
}

/// Clear old log files (keep current)
pub fn clear_old_logs(log_dir: &Path) -> Result<String, String> {
    if !log_dir.exists() {
        return Ok("No log directory found".to_string());
    }

    // First, find all log files and identify the most recent one
    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    let mut log_files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.is_file() &&
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("causal.log"))
                .unwrap_or(false)
        })
        .collect();

    if log_files.is_empty() {
        return Ok("No log files found".to_string());
    }

    // Sort by filename (most recent date last) - this works because filenames are causal.log.YYYY-MM-DD
    log_files.sort();

    // The last file (most recent) is the current log - don't delete it
    let current_log = log_files.pop();

    // Delete all other (older) log files
    let mut deleted_count = 0;
    for path in log_files {
        if fs::remove_file(&path).is_ok() {
            deleted_count += 1;
        }
    }

    if let Some(current) = current_log {
        Ok(format!("Cleared {} old log file(s), kept current log: {}",
            deleted_count,
            current.file_name().unwrap_or_default().to_string_lossy()))
    } else {
        Ok(format!("Cleared {} old log file(s)", deleted_count))
    }
}

/// Clear all logs including current
pub fn clear_all_logs(log_dir: &Path) -> Result<String, String> {
    if !log_dir.exists() {
        return Ok("No log directory found".to_string());
    }

    let mut deleted_count = 0;
    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.to_string_lossy().contains("causal.log")
            && fs::remove_file(&path).is_ok() {
                deleted_count += 1;
            }
    }

    Ok(format!("Cleared {} log file(s)", deleted_count))
}
