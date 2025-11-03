use std::time::{Duration, Instant};
use tokio::sync::mpsc;

/// Represents a buffered segment of transcription
#[derive(Debug, Clone)]
pub struct TranscriptionBuffer {
    pub turn_order: u32,
    pub texts: Vec<String>,
    pub start_time: Instant,
    pub end_time: Instant,
    pub is_complete: bool,
}

impl TranscriptionBuffer {
    pub fn new(turn_order: u32) -> Self {
        Self {
            turn_order,
            texts: Vec::new(),
            start_time: Instant::now(),
            end_time: Instant::now(),
            is_complete: false,
        }
    }

    pub fn add_text(&mut self, text: String) {
        self.texts.push(text);
        self.end_time = Instant::now();
    }

    pub fn combined_text(&self) -> String {
        self.texts.join(" ").trim().to_string()
    }

    pub fn duration(&self) -> Duration {
        self.end_time.duration_since(self.start_time)
    }

    pub fn should_flush(&self, buffer_duration_secs: u64) -> bool {
        self.duration() >= Duration::from_secs(buffer_duration_secs)
    }

    pub fn mark_complete(&mut self) {
        self.is_complete = true;
    }
}

/// Manages buffering of transcription results into configurable chunks
pub struct BufferManager {
    current_buffer: Option<TranscriptionBuffer>,
    buffer_sender: mpsc::UnboundedSender<TranscriptionBuffer>,
    buffer_count: u32,
    buffer_duration_secs: u64,
    immediate_flush: bool, // For real-time mode
}

impl BufferManager {
    /// Create a new buffer manager with default settings (10 second chunks)
    pub fn new(buffer_sender: mpsc::UnboundedSender<TranscriptionBuffer>) -> Self {
        Self::new_with_config(buffer_sender, 10, false)
    }

    /// Create a new buffer manager with custom configuration
    pub fn new_with_config(
        buffer_sender: mpsc::UnboundedSender<TranscriptionBuffer>,
        buffer_duration_secs: u64,
        immediate_flush: bool,
    ) -> Self {
        Self {
            current_buffer: None,
            buffer_sender,
            buffer_count: 0,
            buffer_duration_secs,
            immediate_flush,
        }
    }

    /// Add a transcription result to the buffer
    /// Returns true if a buffer was flushed
    pub fn add_result(&mut self, text: String, end_of_turn: bool) -> bool {
        // Skip empty text
        if text.trim().is_empty() {
            return false;
        }

        // For immediate flush mode (real-time), flush every turn
        if self.immediate_flush {
            self.buffer_count += 1;
            tracing::debug!("Real-time mode: Creating buffer {} for immediate enhancement", self.buffer_count);
            let mut buffer = TranscriptionBuffer::new(self.buffer_count);
            buffer.add_text(text);
            buffer.mark_complete();

            if let Err(e) = self.buffer_sender.send(buffer) {
                tracing::error!("Failed to send buffer: {}", e);
                return false;
            }
            tracing::debug!("Buffer {} sent for enhancement", self.buffer_count);
            return true;
        }

        // Create new buffer if none exists
        if self.current_buffer.is_none() {
            self.buffer_count += 1;
            self.current_buffer = Some(TranscriptionBuffer::new(self.buffer_count));
        }

        // Add text to current buffer
        if let Some(buffer) = &mut self.current_buffer {
            buffer.add_text(text);

            // Check if we should flush based on time or end of turn
            // For chunked mode, use configurable duration
            let min_duration_for_end_of_turn = self.buffer_duration_secs / 2; // At least half the buffer duration
            if buffer.should_flush(self.buffer_duration_secs)
                || (end_of_turn && buffer.duration() >= Duration::from_secs(min_duration_for_end_of_turn)) {
                return self.flush_current_buffer();
            }
        }

        false
    }

    /// Flush the current buffer if it exists
    pub fn flush_current_buffer(&mut self) -> bool {
        if let Some(mut buffer) = self.current_buffer.take() {
            buffer.mark_complete();

            tracing::info!(
                "📦 Buffer {} ready ({} turns, {:.1}s)",
                buffer.turn_order,
                buffer.texts.len(),
                buffer.duration().as_secs_f32()
            );

            if let Err(e) = self.buffer_sender.send(buffer) {
                tracing::error!("Failed to send buffer: {}", e);
                return false;
            }

            return true;
        }

        false
    }

    /// Force flush any remaining buffer (called on stop)
    pub fn flush_all(&mut self) {
        self.flush_current_buffer();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buffer_creation() {
        let buffer = TranscriptionBuffer::new(1);
        assert_eq!(buffer.turn_order, 1);
        assert!(buffer.texts.is_empty());
        assert!(!buffer.is_complete);
    }

    #[test]
    fn test_buffer_add_text() {
        let mut buffer = TranscriptionBuffer::new(1);
        buffer.add_text("Hello".to_string());
        buffer.add_text("World".to_string());

        assert_eq!(buffer.texts.len(), 2);
        assert_eq!(buffer.combined_text(), "Hello World");
    }

    #[test]
    fn test_buffer_should_flush() {
        let buffer = TranscriptionBuffer::new(1);
        // New buffer should not flush immediately
        assert!(!buffer.should_flush());
    }
}
