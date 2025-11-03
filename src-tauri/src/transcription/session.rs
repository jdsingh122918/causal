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
    #[allow(dead_code)]
    pub fn average_confidence(&self) -> f64 {
        if self.confidence_count > 0 {
            self.total_confidence / self.confidence_count as f64
        } else {
            0.0
        }
    }

    #[allow(dead_code)]
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
    #[allow(dead_code)]
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
    #[allow(dead_code)]
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
    #[allow(dead_code)]
    pub fn update_duration(&mut self) {
        if let Ok(elapsed) = self.start_time.elapsed() {
            self.metadata.duration_seconds = elapsed.as_secs_f64();
        }
    }

    /// Update chunk count
    #[allow(dead_code)]
    pub fn set_chunk_count(&mut self, count: usize) {
        self.metadata.chunk_count = count;
    }

    /// Check if session has any data
    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.turns.is_empty() && self.enhanced_buffers.is_empty()
    }

    /// Prepare session data for saving as a recording
    #[allow(dead_code)]
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
    #[allow(dead_code)]
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
    #[allow(dead_code)]
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
    #[allow(dead_code)]
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
    #[allow(dead_code)]
    pub async fn end_session(&self) -> Option<SessionData> {
        let mut session = self.current_session.lock().await;
        session.take()
    }

    /// Check if there's an active session
    #[allow(dead_code)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_session_lifecycle() {
        let manager = SessionManager::new();

        // Initially no session
        assert!(!manager.has_active_session().await);

        // Start session
        manager.start_session(Some("project-1".to_string())).await;
        assert!(manager.has_active_session().await);

        // Get session data
        let session = manager.get_session().await;
        assert!(session.is_some());
        assert_eq!(session.unwrap().project_id, Some("project-1".to_string()));

        // End session
        let ended = manager.end_session().await;
        assert!(ended.is_some());
        assert!(!manager.has_active_session().await);
    }

    #[tokio::test]
    async fn test_add_turns_to_session() {
        let manager = SessionManager::new();
        manager.start_session(None).await;

        // Add turns
        manager.add_turn(1, "First turn.".to_string(), 0.95).await.unwrap();
        manager.add_turn(2, "Second turn.".to_string(), 0.92).await.unwrap();

        let session = manager.get_session().await.unwrap();
        assert_eq!(session.turns.len(), 2);
        assert_eq!(session.metadata.turn_count, 2);
        assert!(session.raw_transcript.contains("First turn"));
        assert!(session.raw_transcript.contains("Second turn"));
    }

    #[tokio::test]
    async fn test_add_enhanced_buffers() {
        let manager = SessionManager::new();
        manager.start_session(None).await;

        manager.add_enhanced_buffer(
            1,
            "raw text one".to_string(),
            "Enhanced text one.".to_string(),
        ).await.unwrap();

        manager.add_enhanced_buffer(
            2,
            "raw text two".to_string(),
            "Enhanced text two.".to_string(),
        ).await.unwrap();

        let session = manager.get_session().await.unwrap();
        assert_eq!(session.enhanced_buffers.len(), 2);
        assert!(session.enhanced_transcript.contains("Enhanced text one"));
        assert!(session.enhanced_transcript.contains("Enhanced text two"));
    }

    #[tokio::test]
    async fn test_session_metadata_calculation() {
        let manager = SessionManager::new();
        manager.start_session(None).await;

        // Add turns with different confidences
        manager.add_turn(1, "Turn one with ten words in it here.".to_string(), 0.9).await.unwrap();
        manager.add_turn(2, "Turn two.".to_string(), 0.8).await.unwrap();

        // Update metadata
        manager.update_metadata(|s| {
            s.update_duration();
            s.set_chunk_count(5);
        }).await.unwrap();

        let session = manager.get_session().await.unwrap();

        // Check metadata
        assert_eq!(session.metadata.turn_count, 2);
        assert_eq!(session.metadata.chunk_count, 5);
        assert!(session.metadata.word_count > 0);

        // Average confidence should be (0.9 + 0.8) / 2 = 0.85
        let avg_conf = session.metadata.total_confidence / session.metadata.confidence_count as f64;
        assert!((avg_conf - 0.85).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_session_to_recording() {
        let mut session = SessionData::new(Some("project-123".to_string()));

        session.add_turn(1, "Hello world.".to_string(), 0.95);
        session.add_enhanced_buffer(1, "Hello world.".to_string(), "Hello, world!".to_string());

        let recording = session.to_recording("project-123".to_string(), "Test Recording".to_string());

        assert!(recording.is_ok());
        let rec = recording.unwrap();

        assert_eq!(rec.project_id, "project-123");
        assert_eq!(rec.name, "Test Recording");
        assert_eq!(rec.raw_transcript, "Hello world.");
        assert_eq!(rec.enhanced_transcript, "Hello, world!");
    }

    #[tokio::test]
    async fn test_empty_session_cannot_be_saved() {
        let session = SessionData::new(None);

        let result = session.to_recording("project-1".to_string(), "Empty".to_string());

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Cannot save empty recording");
    }

    #[tokio::test]
    async fn test_clear_session() {
        let manager = SessionManager::new();
        manager.start_session(Some("project-1".to_string())).await;

        assert!(manager.has_active_session().await);

        manager.clear_session().await;

        assert!(!manager.has_active_session().await);
    }

    #[tokio::test]
    async fn test_session_word_count_updates() {
        let mut session = SessionData::new(None);

        session.add_turn(1, "One two three.".to_string(), 0.9);
        assert_eq!(session.metadata.word_count, 3);

        session.add_turn(2, "Four five.".to_string(), 0.9);
        assert_eq!(session.metadata.word_count, 5);
    }
}
