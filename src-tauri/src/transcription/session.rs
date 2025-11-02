use crate::database::{RecordingMetadata, Recording};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Represents the current active recording session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionData {
    pub project_id: Option<String>,
    pub raw_transcript: String,
    pub enhanced_transcript: String,
    pub turns: Vec<TurnData>,
    pub enhanced_buffers: Vec<EnhancedBufferData>,
    pub start_time: std::time::SystemTime,
    pub metadata: SessionMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnData {
    pub turn_order: usize,
    pub text: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedBufferData {
    pub buffer_id: usize,
    pub raw_text: String,
    pub enhanced_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionMetadata {
    pub duration_seconds: f64,
    pub word_count: usize,
    pub chunk_count: usize,
    pub turn_count: usize,
    pub total_confidence: f64,
    pub confidence_count: usize,
}

impl SessionMetadata {
    pub fn average_confidence(&self) -> f64 {
        if self.confidence_count > 0 {
            self.total_confidence / self.confidence_count as f64
        } else {
            0.0
        }
    }

    pub fn to_recording_metadata(&self) -> RecordingMetadata {
        RecordingMetadata {
            duration_seconds: self.duration_seconds,
            word_count: self.word_count,
            chunk_count: self.chunk_count,
            turn_count: self.turn_count,
            average_confidence: self.average_confidence(),
        }
    }
}

impl Default for SessionData {
    fn default() -> Self {
        Self {
            project_id: None,
            raw_transcript: String::new(),
            enhanced_transcript: String::new(),
            turns: Vec::new(),
            enhanced_buffers: Vec::new(),
            start_time: std::time::SystemTime::now(),
            metadata: SessionMetadata::default(),
        }
    }
}

impl SessionData {
    pub fn new(project_id: Option<String>) -> Self {
        Self {
            project_id,
            ..Default::default()
        }
    }

    /// Add a turn to the session
    pub fn add_turn(&mut self, turn_order: usize, text: String, confidence: f64) {
        self.turns.push(TurnData {
            turn_order,
            text: text.clone(),
            confidence,
        });

        // Update metadata
        self.metadata.turn_count = self.turns.len();
        self.metadata.total_confidence += confidence;
        self.metadata.confidence_count += 1;

        // Update raw transcript
        if !self.raw_transcript.is_empty() {
            self.raw_transcript.push(' ');
        }
        self.raw_transcript.push_str(&text);

        // Update word count
        self.metadata.word_count = self.raw_transcript.split_whitespace().count();
    }

    /// Add an enhanced buffer to the session
    pub fn add_enhanced_buffer(&mut self, buffer_id: usize, raw_text: String, enhanced_text: String) {
        self.enhanced_buffers.push(EnhancedBufferData {
            buffer_id,
            raw_text,
            enhanced_text: enhanced_text.clone(),
        });

        // Rebuild enhanced transcript from all buffers
        self.enhanced_transcript = self
            .enhanced_buffers
            .iter()
            .map(|b| b.enhanced_text.as_str())
            .collect::<Vec<_>>()
            .join(" ");
    }

    /// Update session duration
    pub fn update_duration(&mut self) {
        if let Ok(elapsed) = self.start_time.elapsed() {
            self.metadata.duration_seconds = elapsed.as_secs_f64();
        }
    }

    /// Update chunk count
    pub fn set_chunk_count(&mut self, count: usize) {
        self.metadata.chunk_count = count;
    }

    /// Check if session has any data
    pub fn is_empty(&self) -> bool {
        self.turns.is_empty() && self.enhanced_buffers.is_empty()
    }

    /// Prepare session data for saving as a recording
    pub fn to_recording(&self, project_id: String, name: String) -> Result<Recording, String> {
        if self.is_empty() {
            return Err("Cannot save empty recording".to_string());
        }

        // Use enhanced transcript if available, otherwise use raw
        let transcript_to_save = if !self.enhanced_transcript.is_empty() {
            self.enhanced_transcript.clone()
        } else {
            self.raw_transcript.clone()
        };

        Ok(Recording::new(
            project_id,
            name,
            self.raw_transcript.clone(),
            transcript_to_save,
        )
        .with_metadata(self.metadata.to_recording_metadata()))
    }
}

/// Manages the current recording session
#[derive(Clone)]
pub struct SessionManager {
    current_session: Arc<Mutex<Option<SessionData>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            current_session: Arc::new(Mutex::new(None)),
        }
    }

    /// Start a new session
    pub async fn start_session(&self, project_id: Option<String>) {
        let mut session = self.current_session.lock().await;
        *session = Some(SessionData::new(project_id));
    }

    /// Get a clone of the current session data
    pub async fn get_session(&self) -> Option<SessionData> {
        let session = self.current_session.lock().await;
        session.clone()
    }

    /// Update the current session with a turn
    pub async fn add_turn(&self, turn_order: usize, text: String, confidence: f64) -> Result<(), String> {
        let mut session = self.current_session.lock().await;
        match session.as_mut() {
            Some(s) => {
                s.add_turn(turn_order, text, confidence);
                Ok(())
            }
            None => Err("No active session".to_string()),
        }
    }

    /// Update the current session with an enhanced buffer
    pub async fn add_enhanced_buffer(
        &self,
        buffer_id: usize,
        raw_text: String,
        enhanced_text: String,
    ) -> Result<(), String> {
        let mut session = self.current_session.lock().await;
        match session.as_mut() {
            Some(s) => {
                s.add_enhanced_buffer(buffer_id, raw_text, enhanced_text);
                Ok(())
            }
            None => Err("No active session".to_string()),
        }
    }

    /// Update session metadata
    pub async fn update_metadata<F>(&self, updater: F) -> Result<(), String>
    where
        F: FnOnce(&mut SessionData),
    {
        let mut session = self.current_session.lock().await;
        match session.as_mut() {
            Some(s) => {
                updater(s);
                Ok(())
            }
            None => Err("No active session".to_string()),
        }
    }

    /// End the current session and return the data
    pub async fn end_session(&self) -> Option<SessionData> {
        let mut session = self.current_session.lock().await;
        session.take()
    }

    /// Check if there's an active session
    pub async fn has_active_session(&self) -> bool {
        let session = self.current_session.lock().await;
        session.is_some()
    }

    /// Clear the current session without returning data
    pub async fn clear_session(&self) {
        let mut session = self.current_session.lock().await;
        *session = None;
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}
