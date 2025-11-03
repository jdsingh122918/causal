use tracing::field::{Field, Visit};
use std::fmt;

/// Redacts sensitive fields in log messages based on field name
/// Future: Phase 2 - integrate with custom log formatter
#[allow(dead_code)]
pub fn redact_sensitive_field(field_name: &str, value: &str) -> String {
    match field_name {
        // API keys - show first 8 chars only
        name if name.contains("api_key") || name.contains("_key") || name == "key" => {
            if value.len() > 8 {
                format!("{}...[REDACTED]", &value[..8.min(value.len())])
            } else {
                "[REDACTED]".to_string()
            }
        }
        // Transcript content - show metadata only
        "transcript" | "text" | "raw_text" | "enhanced_text" | "refined_text" => {
            let word_count = value.split_whitespace().count();
            format!("[{} chars, {} words]", value.len(), word_count)
        }
        // Names that might contain PII
        "name" | "project_name" | "recording_name" | "device_name" => {
            if value.len() > 10 {
                format!("{}...", &value[..10])
            } else {
                value.to_string()
            }
        }
        // Default - no redaction
        _ => value.to_string(),
    }
}

/// Visitor for redacting sensitive fields during logging
/// Future: Phase 2 - integrate with custom tracing subscriber
#[allow(dead_code)]
pub struct RedactingVisitor<'a> {
    pub writer: &'a mut dyn fmt::Write,
    pub redact: bool,
}

impl<'a> Visit for RedactingVisitor<'a> {
    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        if self.redact {
            let formatted = format!("{:?}", value);
            let redacted = redact_sensitive_field(field.name(), &formatted);
            let _ = write!(self.writer, "{}={} ", field.name(), redacted);
        } else {
            let _ = write!(self.writer, "{}={:?} ", field.name(), value);
        }
    }

    fn record_str(&mut self, field: &Field, value: &str) {
        if self.redact {
            let redacted = redact_sensitive_field(field.name(), value);
            let _ = write!(self.writer, "{}={} ", field.name(), redacted);
        } else {
            let _ = write!(self.writer, "{}={:?} ", field.name(), value);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redact_api_key() {
        let key = "sk_1234567890abcdefghij";
        let redacted = redact_sensitive_field("api_key", key);
        assert_eq!(redacted, "sk_12345...[REDACTED]");
    }

    #[test]
    fn test_redact_transcript() {
        let text = "Hello world, this is a test transcript with many words.";
        let redacted = redact_sensitive_field("transcript", text);
        assert!(redacted.contains("chars"));
        assert!(redacted.contains("words"));
        assert!(!redacted.contains("Hello"));
    }

    #[test]
    fn test_no_redaction_for_safe_fields() {
        let value = "some_value";
        let result = redact_sensitive_field("safe_field", value);
        assert_eq!(result, value);
    }
}
