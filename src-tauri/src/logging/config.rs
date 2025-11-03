use std::path::PathBuf;
use tracing::Level;

#[derive(Debug, Clone)]
pub struct LoggingConfig {
    pub log_dir: PathBuf,
    pub max_level: Level,
    #[allow(dead_code)] // Future: allow runtime toggling of console output
    pub enable_console: bool,
    #[allow(dead_code)] // Future: allow disabling file logging
    pub enable_file: bool,
    #[allow(dead_code)] // Future: allow runtime format selection
    pub enable_json: bool,
    pub privacy_mode: PrivacyMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrivacyMode {
    Full,      // Log everything (development)
    Redacted,  // Redact PII, API keys, transcripts (production default)
    #[allow(dead_code)] // Future: Phase 3 - minimal logging mode
    Minimal,   // Only errors and critical events
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            log_dir: PathBuf::new(), // Will be set by app
            max_level: if cfg!(debug_assertions) {
                Level::DEBUG
            } else {
                Level::INFO
            },
            enable_console: cfg!(debug_assertions),
            enable_file: true,
            enable_json: !cfg!(debug_assertions),
            privacy_mode: if cfg!(debug_assertions) {
                PrivacyMode::Full
            } else {
                PrivacyMode::Redacted
            },
        }
    }
}

impl LoggingConfig {
    /// Create a new configuration with the specified log directory
    pub fn with_log_dir(mut self, log_dir: PathBuf) -> Self {
        self.log_dir = log_dir;
        self
    }
}
