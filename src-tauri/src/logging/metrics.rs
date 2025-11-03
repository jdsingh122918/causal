use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

/// Application-wide metrics collector
#[derive(Debug, Clone)]
pub struct MetricsCollector {
    inner: Arc<MetricsInner>,
}

#[derive(Debug)]
struct MetricsInner {
    // Transcription metrics
    transcription_sessions_started: AtomicUsize,
    transcription_sessions_completed: AtomicUsize,
    transcription_sessions_failed: AtomicUsize,
    total_transcription_duration_ms: AtomicU64,
    total_words_transcribed: AtomicUsize,

    // Audio metrics
    audio_buffer_overruns: AtomicUsize,
    audio_buffer_underruns: AtomicUsize,
    total_audio_frames_processed: AtomicU64,

    // API metrics
    api_calls_total: AtomicUsize,
    api_calls_successful: AtomicUsize,
    api_calls_failed: AtomicUsize,
    total_api_latency_ms: AtomicU64,

    // Enhancement metrics
    enhancements_requested: AtomicUsize,
    enhancements_completed: AtomicUsize,
    refinements_requested: AtomicUsize,
    refinements_completed: AtomicUsize,

    // Database metrics
    recordings_saved: AtomicUsize,
    projects_created: AtomicUsize,
}

/// Snapshot of current metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    // Transcription stats
    pub transcription_sessions_started: usize,
    pub transcription_sessions_completed: usize,
    pub transcription_sessions_failed: usize,
    pub avg_transcription_duration_ms: f64,
    pub total_words_transcribed: usize,

    // Audio stats
    pub audio_buffer_overruns: usize,
    pub audio_buffer_underruns: usize,
    pub total_audio_frames_processed: u64,

    // API stats
    pub api_calls_total: usize,
    pub api_calls_successful: usize,
    pub api_calls_failed: usize,
    pub api_success_rate: f64,
    pub avg_api_latency_ms: f64,

    // Enhancement stats
    pub enhancements_requested: usize,
    pub enhancements_completed: usize,
    pub refinements_requested: usize,
    pub refinements_completed: usize,

    // Database stats
    pub recordings_saved: usize,
    pub projects_created: usize,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(MetricsInner {
                transcription_sessions_started: AtomicUsize::new(0),
                transcription_sessions_completed: AtomicUsize::new(0),
                transcription_sessions_failed: AtomicUsize::new(0),
                total_transcription_duration_ms: AtomicU64::new(0),
                total_words_transcribed: AtomicUsize::new(0),
                audio_buffer_overruns: AtomicUsize::new(0),
                audio_buffer_underruns: AtomicUsize::new(0),
                total_audio_frames_processed: AtomicU64::new(0),
                api_calls_total: AtomicUsize::new(0),
                api_calls_successful: AtomicUsize::new(0),
                api_calls_failed: AtomicUsize::new(0),
                total_api_latency_ms: AtomicU64::new(0),
                enhancements_requested: AtomicUsize::new(0),
                enhancements_completed: AtomicUsize::new(0),
                refinements_requested: AtomicUsize::new(0),
                refinements_completed: AtomicUsize::new(0),
                recordings_saved: AtomicUsize::new(0),
                projects_created: AtomicUsize::new(0),
            }),
        }
    }

    // Transcription metrics
    pub fn transcription_session_started(&self) {
        self.inner.transcription_sessions_started.fetch_add(1, Ordering::Relaxed);
        tracing::debug!("Transcription session started");
    }

    pub fn transcription_session_completed(&self, duration: Duration, word_count: usize) {
        self.inner.transcription_sessions_completed.fetch_add(1, Ordering::Relaxed);
        self.inner.total_transcription_duration_ms.fetch_add(duration.as_millis() as u64, Ordering::Relaxed);
        self.inner.total_words_transcribed.fetch_add(word_count, Ordering::Relaxed);
        tracing::info!(
            duration_ms = duration.as_millis(),
            word_count = word_count,
            "Transcription session completed"
        );
    }

    pub fn transcription_session_failed(&self) {
        self.inner.transcription_sessions_failed.fetch_add(1, Ordering::Relaxed);
        tracing::warn!("Transcription session failed");
    }

    // Audio metrics
    pub fn audio_buffer_overrun(&self) {
        self.inner.audio_buffer_overruns.fetch_add(1, Ordering::Relaxed);
        tracing::warn!("Audio buffer overrun detected");
    }

    pub fn audio_buffer_underrun(&self) {
        self.inner.audio_buffer_underruns.fetch_add(1, Ordering::Relaxed);
        tracing::warn!("Audio buffer underrun detected");
    }

    pub fn audio_frames_processed(&self, count: u64) {
        self.inner.total_audio_frames_processed.fetch_add(count, Ordering::Relaxed);
    }

    // API metrics
    pub fn api_call_started(&self) {
        self.inner.api_calls_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn api_call_completed(&self, latency: Duration, success: bool) {
        self.inner.total_api_latency_ms.fetch_add(latency.as_millis() as u64, Ordering::Relaxed);
        if success {
            self.inner.api_calls_successful.fetch_add(1, Ordering::Relaxed);
        } else {
            self.inner.api_calls_failed.fetch_add(1, Ordering::Relaxed);
        }
        tracing::debug!(
            latency_ms = latency.as_millis(),
            success = success,
            "API call completed"
        );
    }

    // Enhancement metrics
    pub fn enhancement_requested(&self) {
        self.inner.enhancements_requested.fetch_add(1, Ordering::Relaxed);
    }

    pub fn enhancement_completed(&self) {
        self.inner.enhancements_completed.fetch_add(1, Ordering::Relaxed);
    }

    pub fn refinement_requested(&self) {
        self.inner.refinements_requested.fetch_add(1, Ordering::Relaxed);
    }

    pub fn refinement_completed(&self) {
        self.inner.refinements_completed.fetch_add(1, Ordering::Relaxed);
    }

    // Database metrics
    pub fn recording_saved(&self) {
        self.inner.recordings_saved.fetch_add(1, Ordering::Relaxed);
    }

    pub fn project_created(&self) {
        self.inner.projects_created.fetch_add(1, Ordering::Relaxed);
    }

    /// Get a snapshot of current metrics
    pub fn snapshot(&self) -> MetricsSnapshot {
        let sessions_completed = self.inner.transcription_sessions_completed.load(Ordering::Relaxed);
        let total_duration_ms = self.inner.total_transcription_duration_ms.load(Ordering::Relaxed);
        let avg_duration = if sessions_completed > 0 {
            total_duration_ms as f64 / sessions_completed as f64
        } else {
            0.0
        };

        let api_calls = self.inner.api_calls_total.load(Ordering::Relaxed);
        let api_successful = self.inner.api_calls_successful.load(Ordering::Relaxed);
        let api_failed = self.inner.api_calls_failed.load(Ordering::Relaxed);
        let api_success_rate = if api_calls > 0 {
            (api_successful as f64 / api_calls as f64) * 100.0
        } else {
            0.0
        };

        let total_api_latency = self.inner.total_api_latency_ms.load(Ordering::Relaxed);
        let avg_api_latency = if api_calls > 0 {
            total_api_latency as f64 / api_calls as f64
        } else {
            0.0
        };

        MetricsSnapshot {
            transcription_sessions_started: self.inner.transcription_sessions_started.load(Ordering::Relaxed),
            transcription_sessions_completed: sessions_completed,
            transcription_sessions_failed: self.inner.transcription_sessions_failed.load(Ordering::Relaxed),
            avg_transcription_duration_ms: avg_duration,
            total_words_transcribed: self.inner.total_words_transcribed.load(Ordering::Relaxed),
            audio_buffer_overruns: self.inner.audio_buffer_overruns.load(Ordering::Relaxed),
            audio_buffer_underruns: self.inner.audio_buffer_underruns.load(Ordering::Relaxed),
            total_audio_frames_processed: self.inner.total_audio_frames_processed.load(Ordering::Relaxed),
            api_calls_total: api_calls,
            api_calls_successful: api_successful,
            api_calls_failed: api_failed,
            api_success_rate,
            avg_api_latency_ms: avg_api_latency,
            enhancements_requested: self.inner.enhancements_requested.load(Ordering::Relaxed),
            enhancements_completed: self.inner.enhancements_completed.load(Ordering::Relaxed),
            refinements_requested: self.inner.refinements_requested.load(Ordering::Relaxed),
            refinements_completed: self.inner.refinements_completed.load(Ordering::Relaxed),
            recordings_saved: self.inner.recordings_saved.load(Ordering::Relaxed),
            projects_created: self.inner.projects_created.load(Ordering::Relaxed),
        }
    }

    /// Reset all metrics to zero
    pub fn reset(&self) {
        self.inner.transcription_sessions_started.store(0, Ordering::Relaxed);
        self.inner.transcription_sessions_completed.store(0, Ordering::Relaxed);
        self.inner.transcription_sessions_failed.store(0, Ordering::Relaxed);
        self.inner.total_transcription_duration_ms.store(0, Ordering::Relaxed);
        self.inner.total_words_transcribed.store(0, Ordering::Relaxed);
        self.inner.audio_buffer_overruns.store(0, Ordering::Relaxed);
        self.inner.audio_buffer_underruns.store(0, Ordering::Relaxed);
        self.inner.total_audio_frames_processed.store(0, Ordering::Relaxed);
        self.inner.api_calls_total.store(0, Ordering::Relaxed);
        self.inner.api_calls_successful.store(0, Ordering::Relaxed);
        self.inner.api_calls_failed.store(0, Ordering::Relaxed);
        self.inner.total_api_latency_ms.store(0, Ordering::Relaxed);
        self.inner.enhancements_requested.store(0, Ordering::Relaxed);
        self.inner.enhancements_completed.store(0, Ordering::Relaxed);
        self.inner.refinements_requested.store(0, Ordering::Relaxed);
        self.inner.refinements_completed.store(0, Ordering::Relaxed);
        self.inner.recordings_saved.store(0, Ordering::Relaxed);
        self.inner.projects_created.store(0, Ordering::Relaxed);
        tracing::info!("Metrics reset");
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper for timing operations
pub struct TimedOperation {
    start: Instant,
}

impl TimedOperation {
    pub fn new() -> Self {
        Self {
            start: Instant::now(),
        }
    }

    pub fn elapsed(&self) -> Duration {
        self.start.elapsed()
    }
}

impl Default for TimedOperation {
    fn default() -> Self {
        Self::new()
    }
}
