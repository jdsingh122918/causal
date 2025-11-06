//! Tests for transcription buffer management

use causal_lib::transcription::buffer::{BufferManager, TranscriptionBuffer};
use std::time::Duration;
use tokio::sync::mpsc;

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
fn test_buffer_should_flush_time_based() {
    let buffer = TranscriptionBuffer::new(1);

    // Newly created buffer should not flush immediately
    assert!(!buffer.should_flush(10));

    // Sleep to allow time to pass
    std::thread::sleep(Duration::from_millis(100));

    // Still should not flush with 10 second threshold
    assert!(!buffer.should_flush(10));

    // But should flush with very short threshold
    assert!(buffer.should_flush(0));
}

#[test]
fn test_buffer_mark_complete() {
    let mut buffer = TranscriptionBuffer::new(1);

    assert!(!buffer.is_complete);

    buffer.mark_complete();

    assert!(buffer.is_complete);
}

#[test]
fn test_buffer_manager_initialization() {
    let (tx, _rx) = mpsc::unbounded_channel();
    let manager = BufferManager::new(tx, 10);

    assert_eq!(manager.buffer_duration_secs, 10);
    assert_eq!(manager.buffer_count, 0);
    assert!(manager.current_buffer.is_none());
}

#[test]
fn test_buffer_manager_add_text_creates_buffer() {
    let (tx, _rx) = mpsc::unbounded_channel();
    let mut manager = BufferManager::new(tx, 10);

    let flushed = manager.add_text("Test text".to_string(), false);

    assert!(!flushed);
    assert!(manager.current_buffer.is_some());
    assert_eq!(manager.buffer_count, 1);
}

#[test]
fn test_buffer_manager_flush_on_end_of_turn() {
    let (tx, mut rx) = mpsc::unbounded_channel();
    let mut manager = BufferManager::new(tx, 10);

    // Add text and mark end of turn
    manager.add_text("First text".to_string(), false);

    // Sleep to ensure minimum duration
    std::thread::sleep(Duration::from_secs(6));

    // Add more text with end_of_turn flag
    let flushed = manager.add_text("Second text".to_string(), true);

    assert!(flushed);
    assert!(manager.current_buffer.is_none());

    // Verify buffer was sent
    let buffer = rx.try_recv().expect("Buffer should be sent");
    assert_eq!(buffer.turn_order, 1);
    assert!(buffer.combined_text().contains("First text"));
    assert!(buffer.combined_text().contains("Second text"));
}

#[test]
fn test_buffer_manager_flush_all() {
    let (tx, mut rx) = mpsc::unbounded_channel();
    let mut manager = BufferManager::new(tx, 10);

    // Add some text
    manager.add_text("Test text".to_string(), false);

    // Flush all
    manager.flush_all();

    assert!(manager.current_buffer.is_none());

    // Verify buffer was sent
    let buffer = rx.try_recv().expect("Buffer should be sent");
    assert_eq!(buffer.turn_order, 1);
}

#[test]
fn test_buffer_combined_text_joins_with_spaces() {
    let mut buffer = TranscriptionBuffer::new(1);

    buffer.add_text("First".to_string());
    buffer.add_text("Second".to_string());
    buffer.add_text("Third".to_string());

    assert_eq!(buffer.combined_text(), "First Second Third");
}

#[test]
fn test_buffer_duration_measurement() {
    let buffer = TranscriptionBuffer::new(1);

    // Newly created buffer has minimal duration
    assert!(buffer.duration() < Duration::from_millis(10));

    // After some time
    std::thread::sleep(Duration::from_millis(50));

    // Duration should be measurable
    assert!(buffer.duration() >= Duration::from_millis(40));
}
