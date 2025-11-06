//! Mock implementations for external APIs used in testing

use serde_json::json;

/// Mock AssemblyAI WebSocket responses for testing
pub mod assemblyai {
    use super::*;

    /// Create a mock "Begin" message from AssemblyAI
    pub fn create_begin_message(session_id: &str) -> String {
        json!({
            "type": "Begin",
            "id": session_id,
            "expires_at": 1700000000
        })
        .to_string()
    }

    /// Create a mock "Turn" message from AssemblyAI
    pub fn create_turn_message(
        turn_order: u32,
        transcript: &str,
        end_of_turn: bool,
    ) -> String {
        json!({
            "type": "Turn",
            "turn_order": turn_order,
            "end_of_turn": end_of_turn,
            "end_of_turn_confidence": 0.95,
            "transcript": transcript,
            "words": [
                {
                    "text": transcript,
                    "start": 0,
                    "end": 1000,
                    "confidence": 0.95,
                    "word_is_final": true
                }
            ]
        })
        .to_string()
    }

    /// Create a mock "Termination" message from AssemblyAI
    pub fn create_termination_message() -> String {
        json!({
            "type": "Termination",
            "audio_duration_seconds": 10.5,
            "session_duration_seconds": 11.0
        })
        .to_string()
    }

    /// Create a mock "Error" message from AssemblyAI
    pub fn create_error_message(error: &str) -> String {
        json!({
            "type": "Error",
            "error": error
        })
        .to_string()
    }

    /// Create a sequence of mock turn messages for testing
    pub fn create_turn_sequence(count: usize) -> Vec<String> {
        (1..=count)
            .map(|i| {
                create_turn_message(
                    i as u32,
                    &format!("This is turn number {}", i),
                    i % 3 == 0, // End of turn every 3 turns
                )
            })
            .collect()
    }
}

/// Mock Claude API responses for testing
pub mod claude {
    use super::*;

    /// Create a mock Claude API response for enhancement
    pub fn create_enhancement_response(enhanced_text: &str) -> String {
        json!({
            "content": [
                {
                    "type": "text",
                    "text": enhanced_text
                }
            ],
            "role": "assistant",
            "model": "claude-haiku-4-5-20251001",
            "usage": {
                "input_tokens": 100,
                "output_tokens": 150
            }
        })
        .to_string()
    }

    /// Create a mock error response from Claude API
    pub fn create_error_response(error: &str, error_type: &str) -> String {
        json!({
            "type": "error",
            "error": {
                "type": error_type,
                "message": error
            }
        })
        .to_string()
    }

    /// Create a mock streaming response chunk
    pub fn create_streaming_chunk(text: &str, is_final: bool) -> String {
        json!({
            "type": "content_block_delta",
            "delta": {
                "type": "text_delta",
                "text": text
            },
            "index": 0,
            "stop_reason": if is_final { Some("end_turn") } else { None }
        })
        .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assemblyai_begin_message() {
        let message = assemblyai::create_begin_message("test-session-123");
        assert!(message.contains("Begin"));
        assert!(message.contains("test-session-123"));
    }

    #[test]
    fn test_assemblyai_turn_message() {
        let message = assemblyai::create_turn_message(1, "Hello world", false);
        assert!(message.contains("Turn"));
        assert!(message.contains("Hello world"));
        assert!(message.contains("\"turn_order\":1"));
    }

    #[test]
    fn test_assemblyai_turn_sequence() {
        let sequence = assemblyai::create_turn_sequence(5);
        assert_eq!(sequence.len(), 5);
        assert!(sequence[0].contains("turn number 1"));
        assert!(sequence[4].contains("turn number 5"));
    }

    #[test]
    fn test_claude_enhancement_response() {
        let response = claude::create_enhancement_response("Enhanced text");
        assert!(response.contains("Enhanced text"));
        assert!(response.contains("claude-haiku"));
    }

    #[test]
    fn test_claude_error_response() {
        let response = claude::create_error_response("API key invalid", "authentication_error");
        assert!(response.contains("API key invalid"));
        assert!(response.contains("authentication_error"));
    }
}
