pub mod assemblyai;
pub mod audio;
pub mod buffer;
pub mod buffer_pool;
pub mod commands;
pub mod enhancement;
pub mod recording_commands;
pub mod refinement;
pub mod session;
pub mod summary;

pub use commands::*;
pub use recording_commands::*;

use serde::{Deserialize, Serialize};

/// Refinement mode for AI enhancement of transcripts
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum RefinementMode {
    /// No AI enhancement, show raw transcription only
    Disabled,
    /// Refine each turn immediately as it arrives
    Realtime,
    /// Buffer multiple turns and refine in chunks
    #[default]
    Chunked,
}

/// Configuration for refinement behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefinementConfig {
    pub mode: RefinementMode,
    /// Duration in seconds for chunked mode (5-30)
    pub chunk_duration_secs: u64,
}

impl Default for RefinementConfig {
    fn default() -> Self {
        Self {
            mode: RefinementMode::Chunked,
            chunk_duration_secs: 15,
        }
    }
}
