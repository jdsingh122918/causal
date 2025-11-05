/// Central error type for the Causal application
#[derive(Debug, thiserror::Error)]
#[allow(dead_code)] // Available for future use as error handling is expanded
pub enum CausalError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Audio capture error: {0}")]
    Audio(String),

    #[error("Transcription error: {0}")]
    Transcription(String),

    #[error("Logging initialization error: {0}")]
    Logging(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("WebSocket error: {0}")]
    WebSocket(String),

    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Generic error: {0}")]
    Generic(String),
}

impl From<&str> for CausalError {
    fn from(s: &str) -> Self {
        CausalError::Generic(s.to_string())
    }
}

impl From<String> for CausalError {
    fn from(s: String) -> Self {
        CausalError::Generic(s)
    }
}

/// Result type alias for Causal operations
#[allow(dead_code)] // Available for future use as error handling is expanded
pub type CausalResult<T> = Result<T, CausalError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_conversions() {
        // Test string conversions
        let error_from_str: CausalError = "test error".into();
        assert!(matches!(error_from_str, CausalError::Generic(_)));

        let error_from_string: CausalError = "test error".to_string().into();
        assert!(matches!(error_from_string, CausalError::Generic(_)));

        // Test Display trait
        let error = CausalError::Audio("microphone not found".to_string());
        assert_eq!(error.to_string(), "Audio capture error: microphone not found");

        let error = CausalError::Database(rusqlite::Error::InvalidPath("bad path".into()));
        assert!(error.to_string().contains("Database error"));

        let error = CausalError::Transcription("API timeout".to_string());
        assert_eq!(error.to_string(), "Transcription error: API timeout");
    }

    #[test]
    fn test_error_chain() {
        // Test that errors can be chained properly
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let causal_error: CausalError = io_error.into();

        assert!(matches!(causal_error, CausalError::Io(_)));
        assert!(causal_error.to_string().contains("IO error"));
    }

    #[test]
    fn test_result_type_alias() {
        // Test that CausalResult works as expected
        fn test_function() -> CausalResult<String> {
            Ok("success".to_string())
        }

        fn test_error_function() -> CausalResult<String> {
            Err(CausalError::Config("invalid config".to_string()))
        }

        assert!(test_function().is_ok());
        assert!(test_error_function().is_err());

        if let Err(e) = test_error_function() {
            assert!(matches!(e, CausalError::Config(_)));
        }
    }

    #[test]
    fn test_all_error_variants() {
        // Test all error variants have proper Display implementations
        let errors = vec![
            CausalError::Database(rusqlite::Error::InvalidPath("test".into())),
            CausalError::Audio("test".to_string()),
            CausalError::Transcription("test".to_string()),
            CausalError::Logging("test".to_string()),
            CausalError::Config("test".to_string()),
            CausalError::Io(std::io::Error::new(std::io::ErrorKind::Other, "test")),
            CausalError::Serialization(serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::Other, "test"))),
            CausalError::WebSocket("test".to_string()),
            CausalError::Generic("test".to_string()),
        ];

        for error in errors {
            // Each error should have a non-empty string representation
            let error_string = error.to_string();
            assert!(!error_string.is_empty());
            assert!(error_string.len() > 5); // Should have meaningful content
        }
    }
}