//! Test utilities for Causal application testing
//!
//! This module provides common test helpers, mocks, and fixtures
//! used across the test suite.

use crate::database::models::{Project, Recording};
use crate::transcription::buffer::TranscriptionBuffer;
use chrono::Utc;
use std::path::PathBuf;
use tempfile::TempDir;

/// Create a temporary directory for testing
pub fn create_temp_dir() -> TempDir {
    tempfile::tempdir().expect("Failed to create temp directory")
}

/// Create a test database path in a temporary directory
pub fn create_test_db_path() -> (TempDir, PathBuf) {
    let temp_dir = create_temp_dir();
    let db_path = temp_dir.path().join("test.db");
    (temp_dir, db_path)
}

/// Create a mock project for testing
pub fn create_mock_project(name: &str, description: &str) -> Project {
    Project {
        id: 1,
        name: name.to_string(),
        description: description.to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Create a mock recording for testing
pub fn create_mock_recording(project_id: i64, name: &str) -> Recording {
    Recording {
        id: 1,
        project_id,
        name: name.to_string(),
        transcript: Some("Test transcript".to_string()),
        enhanced_transcript: Some("Enhanced test transcript".to_string()),
        duration_seconds: Some(120),
        created_at: Utc::now(),
        metadata: None,
    }
}

/// Create a mock transcription buffer for testing
pub fn create_mock_buffer(turn_order: u32, text: &str) -> TranscriptionBuffer {
    let mut buffer = TranscriptionBuffer::new(turn_order);
    buffer.add_text(text.to_string());
    buffer
}

/// Create multiple mock transcription buffers
pub fn create_mock_buffers(count: usize) -> Vec<TranscriptionBuffer> {
    (1..=count)
        .map(|i| create_mock_buffer(i as u32, &format!("Buffer {} text", i)))
        .collect()
}

/// Assert that a string contains expected substrings
#[macro_export]
macro_rules! assert_contains {
    ($haystack:expr, $needle:expr) => {
        assert!(
            $haystack.contains($needle),
            "Expected '{}' to contain '{}'",
            $haystack,
            $needle
        );
    };
}

/// Assert that a result is an error with a specific message
#[macro_export]
macro_rules! assert_error_contains {
    ($result:expr, $expected:expr) => {
        match $result {
            Ok(_) => panic!("Expected error, got Ok"),
            Err(e) => {
                let error_msg = e.to_string();
                assert!(
                    error_msg.contains($expected),
                    "Expected error message to contain '{}', got '{}'",
                    $expected,
                    error_msg
                );
            }
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_temp_dir() {
        let temp_dir = create_temp_dir();
        assert!(temp_dir.path().exists());
    }

    #[test]
    fn test_create_mock_project() {
        let project = create_mock_project("Test", "Description");
        assert_eq!(project.name, "Test");
        assert_eq!(project.description, "Description");
    }

    #[test]
    fn test_create_mock_buffer() {
        let buffer = create_mock_buffer(1, "Test text");
        assert_eq!(buffer.turn_order, 1);
        assert_eq!(buffer.combined_text(), "Test text");
    }

    #[test]
    fn test_create_mock_buffers() {
        let buffers = create_mock_buffers(3);
        assert_eq!(buffers.len(), 3);
        assert_eq!(buffers[0].turn_order, 1);
        assert_eq!(buffers[2].turn_order, 3);
    }
}
