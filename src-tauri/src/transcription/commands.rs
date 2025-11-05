use crate::logging::MetricsCollector;
use crate::transcription::{
    assemblyai::{self, AssemblyAIClient},
    audio,
    buffer::{BufferManager, TranscriptionBuffer},
    enhancement::EnhancementAgent,
    refinement::RefinementAgent,
    session::SessionManager,
    summary, RefinementConfig, RefinementMode,
};
use cpal::traits::DeviceTrait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, Mutex};

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionState {
    pub is_active: bool,
    pub device_id: Option<String>,
}

pub struct AppState {
    pub transcription_active: Arc<Mutex<bool>>,
    pub stop_sender: Arc<Mutex<Option<mpsc::UnboundedSender<()>>>>,
    pub audio_handle: Arc<Mutex<Option<audio::AudioCaptureHandle>>>,
    pub chunk_sender: Arc<Mutex<Option<mpsc::Sender<Vec<i16>>>>>,
    pub session_manager: SessionManager,
    pub current_project_id: Arc<Mutex<Option<String>>>,
    pub session_start_time: Arc<Mutex<Option<Instant>>>,
    pub metrics: Arc<MetricsCollector>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            transcription_active: Arc::new(Mutex::new(false)),
            stop_sender: Arc::new(Mutex::new(None)),
            audio_handle: Arc::new(Mutex::new(None)),
            chunk_sender: Arc::new(Mutex::new(None)),
            session_manager: SessionManager::new(),
            current_project_id: Arc::new(Mutex::new(None)),
            session_start_time: Arc::new(Mutex::new(None)),
            metrics: Arc::new(MetricsCollector::new()),
        }
    }
}

#[tracing::instrument]
#[tauri::command]
pub async fn list_audio_devices() -> Result<Vec<audio::AudioDevice>, String> {
    tracing::info!("Listing audio devices");
    audio::list_audio_devices()
}

#[tracing::instrument(skip(app, state, api_key, claude_api_key))]
#[tauri::command]
pub async fn start_transcription(
    app: AppHandle,
    state: State<'_, AppState>,
    device_id: String,
    api_key: String,
    claude_api_key: Option<String>,
    project_id: Option<String>,
    refinement_config: Option<RefinementConfig>,
) -> Result<(), String> {
    let refinement_cfg = refinement_config.unwrap_or_default();
    tracing::info!(
        "Starting transcription for device: {} (project: {:?}, refinement: {:?})",
        device_id,
        project_id,
        refinement_cfg.mode
    );

    // Track metrics
    state.metrics.transcription_session_started();

    // Check if already active
    let mut is_active = state.transcription_active.lock().await;
    if *is_active {
        return Err("Transcription already active".to_string());
    }

    // Get the audio device and validate it's an input device
    if device_id.starts_with("output_") {
        return Err(
            "Cannot use output devices (speakers) for recording. Please select an input device (microphone) instead. \
            Note: To capture system audio on macOS, you need special loopback software like BlackHole or Soundflower."
                .to_string(),
        );
    }

    let device = audio::get_device_by_id(&device_id)?;

    // Create channels for audio chunks and transcription results
    // Use a bounded channel with small buffer to prevent excessive buffering during stop
    let (chunk_tx, chunk_rx) = mpsc::channel(10); // ~500ms buffer at 50ms chunks
    let (transcript_tx, mut transcript_rx) = mpsc::unbounded_channel();
    let (stop_tx, mut stop_rx) = mpsc::unbounded_channel();

    // Clone Arc references to move into the spawned task
    let transcription_active = state.transcription_active.clone();
    let stop_sender_state = state.stop_sender.clone();
    let audio_handle_state = state.audio_handle.clone();
    let chunk_sender_state = state.chunk_sender.clone();
    let session_manager_transcript = state.session_manager.clone();
    let session_manager_enhanced = state.session_manager.clone();

    // Store stop sender and chunk sender
    *state.stop_sender.lock().await = Some(stop_tx.clone());
    *state.chunk_sender.lock().await = Some(chunk_tx.clone());
    *is_active = true;
    drop(is_active); // Release the lock

    // Track session start time
    *state.session_start_time.lock().await = Some(Instant::now());

    // Start a new session
    state
        .session_manager
        .start_session(project_id.clone())
        .await;

    // Update current project ID
    *state.current_project_id.lock().await = project_id.clone();

    // Get device config for sample rate
    let device_config = device
        .default_input_config()
        .map_err(|e| format!("Failed to get default input config: {}", e))?;
    let sample_rate = device_config.sample_rate().0;

    // Create AssemblyAI client and start chunk processing
    let client = AssemblyAIClient::new(api_key);

    // Create channels for buffering and enhancement
    let (buffer_tx, mut buffer_rx) = mpsc::unbounded_channel::<TranscriptionBuffer>();

    // Spawn task to handle transcription
    let app_clone = app.clone();
    let enhancement_enabled =
        claude_api_key.is_some() && refinement_cfg.mode != RefinementMode::Disabled;

    // Spawn async task for streaming processing
    tokio::spawn(async move {
        // Start the AssemblyAI Universal Streaming
        let app_for_error = app_clone.clone();
        let config = assemblyai::StreamingConfig::default();
        let mut processing_handle = tokio::spawn(async move {
            if let Err(e) = client
                .stream_audio(chunk_rx, transcript_tx, sample_rate, config)
                .await
            {
                tracing::error!("Streaming error: {}", e);
                // Emit error to frontend
                let _ = app_for_error.emit("transcription_error", e);
            }
        });

        // Handle transcript results with buffering
        let app_for_transcripts = app_clone.clone();

        // Configure buffer manager based on refinement mode
        let immediate_flush = refinement_cfg.mode == RefinementMode::Realtime;
        let mut buffer_manager = BufferManager::new_with_config(
            buffer_tx,
            refinement_cfg.chunk_duration_secs,
            immediate_flush,
        );

        let transcript_handle = tokio::spawn(async move {
            let mut last_transcript_time = std::time::Instant::now();
            let mut transcript_count = 0usize;

            loop {
                // Use timeout to detect when no transcripts are received
                match tokio::time::timeout(
                    tokio::time::Duration::from_secs(10),
                    transcript_rx.recv(),
                )
                .await
                {
                    Ok(Some(result)) => {
                        transcript_count += 1;
                        last_transcript_time = std::time::Instant::now();

                        // Track in session manager
                        if result.is_final {
                            if let Err(e) = session_manager_transcript
                                .add_turn(
                                    result.turn_order as usize,
                                    result.text.clone(),
                                    result.confidence as f64,
                                )
                                .await
                            {
                                tracing::error!("Failed to track turn in session: {}", e);
                            }
                        }

                        // Emit raw transcript immediately for low-latency display
                        if let Err(e) = app_for_transcripts.emit("transcript", result.clone()) {
                            tracing::error!("Failed to emit transcript event: {}", e);
                        }

                        // Only add FINAL turns to buffer for enhancement
                        // This prevents duplicates from partial turn updates
                        if result.is_final {
                            tracing::debug!(
                                "Adding final turn {} to buffer manager",
                                result.turn_order
                            );
                            buffer_manager.add_result(result.text, result.end_of_turn);
                        } else {
                            tracing::debug!(
                                "Received partial turn {} (skipping buffer)",
                                result.turn_order
                            );
                        }
                    }
                    Ok(None) => {
                        // Channel closed
                        tracing::info!(
                            "Transcript channel closed after {} transcripts",
                            transcript_count
                        );
                        break;
                    }
                    Err(_) => {
                        // Timeout - no transcript received in 10 seconds
                        if transcript_count == 0 {
                            tracing::warn!("⚠️  No speech detected yet ({}s). Check: microphone selection, mute status, or speak louder",
                                last_transcript_time.elapsed().as_secs());
                        }
                    }
                }
            }

            // Flush any remaining buffer when stream ends
            buffer_manager.flush_all();
        });

        // Handle enhancement if Claude API key provided
        let enhancement_handle = if enhancement_enabled {
            if let Some(claude_key) = claude_api_key {
                let app_for_enhanced = app_clone.clone();
                let agent = EnhancementAgent::new(claude_key);

                Some(tokio::spawn(async move {
                    while let Some(buffer) = buffer_rx.recv().await {
                        match agent.enhance(buffer).await {
                            Ok(enhanced) => {
                                // Track in session manager
                                if let Err(e) = session_manager_enhanced
                                    .add_enhanced_buffer(
                                        enhanced.buffer_id as usize,
                                        enhanced.raw_text.clone(),
                                        enhanced.enhanced_text.clone(),
                                    )
                                    .await
                                {
                                    tracing::error!(
                                        "Failed to track enhanced buffer in session: {}",
                                        e
                                    );
                                }

                                if let Err(e) =
                                    app_for_enhanced.emit("enhanced_transcript", enhanced)
                                {
                                    tracing::error!("Failed to emit enhanced transcript: {}", e);
                                }
                            }
                            Err(e) => {
                                tracing::error!("Enhancement error: {}", e);
                            }
                        }
                    }
                }))
            } else {
                None
            }
        } else {
            None
        };

        // Wait for stop signal or completion
        tokio::select! {
            _ = stop_rx.recv() => {
                tracing::info!("Stop signal received - aborting all tasks immediately");

                // CRITICAL FIX: Abort processing handle IMMEDIATELY to close WebSocket
                processing_handle.abort();
                tracing::info!("Processing handle aborted");

                // Abort transcript handler immediately to stop processing events
                transcript_handle.abort();
                tracing::info!("Transcript handle aborted");

                // Abort enhancement handle if it exists
                if let Some(handle) = enhancement_handle {
                    handle.abort();
                    tracing::info!("Enhancement handle aborted");
                }
            }
            _ = &mut processing_handle => {
                tracing::info!("Streaming completed naturally");

                // Natural completion - give handlers time to finish
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                transcript_handle.abort();

                if let Some(handle) = enhancement_handle {
                    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                    handle.abort();
                }
            }
        }

        *transcription_active.lock().await = false;
        *stop_sender_state.lock().await = None;
        *chunk_sender_state.lock().await = None;

        // Stop audio capture if still running
        if let Some(audio_handle) = audio_handle_state.lock().await.take() {
            tokio::task::spawn_blocking(move || {
                if let Err(e) = audio_handle.stop() {
                    tracing::error!("Error stopping audio capture: {}", e);
                }
            });
        }
    });

    // Create audio capture and start it on a dedicated thread (real-time streaming)
    let capture = audio::AudioCapture::new(device, chunk_tx)?;
    let audio_handle = capture.start()?;

    // Store the audio handle so we can stop it later
    *state.audio_handle.lock().await = Some(audio_handle);

    // Emit transcription started event
    if let Err(e) = app.emit("transcription_started", serde_json::json!({
        "device_id": device_id,
        "project_id": project_id
    })) {
        tracing::error!("Failed to emit transcription_started event: {}", e);
    }

    tracing::info!("Real-time transcription started successfully");
    Ok(())
}

#[tracing::instrument(skip(app, state))]
#[tauri::command]
pub async fn stop_transcription(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    tracing::info!("Stopping transcription");

    // Check if already stopped (transcription may have stopped due to error)
    let is_active = *state.transcription_active.lock().await;
    if !is_active {
        tracing::info!("Transcription already stopped");
        return Ok(()); // Return success, not an error
    }

    // Get session duration and word count for metrics
    let start_time = state.session_start_time.lock().await.take();

    // Update session duration before accessing session data
    state.session_manager.update_metadata(|session| {
        session.update_duration();
    }).await.ok();

    let session_data = state.session_manager.get_session().await;
    let word_count = session_data.map(|s| s.metadata.word_count).unwrap_or(0);

    // CRITICAL FIX: Drop the chunk_tx sender FIRST to close the channel
    // This signals the WebSocket write task to terminate properly
    if let Some(_chunk_tx) = state.chunk_sender.lock().await.take() {
        tracing::info!("Chunk sender dropped - channel closed");
        // chunk_tx is dropped here, closing the channel
    }

    // Now stop the audio capture thread
    // This ensures no more audio data is sent
    if let Some(audio_handle) = state.audio_handle.lock().await.take() {
        // Spawn a blocking task to stop the audio thread
        // This is necessary because stop() calls join() which blocks
        tokio::task::spawn_blocking(move || {
            if let Err(e) = audio_handle.stop() {
                tracing::error!("Error stopping audio capture: {}", e);
            } else {
                tracing::info!("Audio capture stopped successfully");
            }
        })
        .await
        .map_err(|e| format!("Failed to join audio stop task: {}", e))?;
    }

    // Send stop signal to the transcription task
    // This allows the main task to complete cleanup
    if let Some(stop_tx) = state.stop_sender.lock().await.take() {
        let _ = stop_tx.send(());
    }

    // Mark as inactive
    *state.transcription_active.lock().await = false;

    // Emit transcription stopped event
    if let Err(e) = app.emit("transcription_stopped", serde_json::json!({})) {
        tracing::error!("Failed to emit transcription_stopped event: {}", e);
    }

    // Record completion metrics
    if let Some(start) = start_time {
        let duration = start.elapsed();
        state.metrics.transcription_session_completed(duration, word_count);
    }

    tracing::info!("Stop signal sent - transcription fully stopped");
    Ok(())
}

#[tauri::command]
pub async fn get_transcription_status(
    state: State<'_, AppState>,
) -> Result<TranscriptionState, String> {
    let is_active = *state.transcription_active.lock().await;
    Ok(TranscriptionState {
        is_active,
        device_id: None, // TODO: Store and return current device_id
    })
}

#[tauri::command]
pub async fn summarize_transcription(
    transcript_text: String,
    chunk_count: u32,
    claude_api_key: String,
) -> Result<summary::TranscriptSummary, String> {
    tracing::info!(
        "Summarizing transcription: {} words, {} chunks",
        transcript_text.split_whitespace().count(),
        chunk_count
    );

    let summary_service = summary::SummaryService::new(claude_api_key);
    summary_service
        .summarize(transcript_text, chunk_count)
        .await
}

#[tauri::command]
pub async fn refine_transcript(
    transcript_text: String,
    claude_api_key: String,
) -> Result<crate::transcription::refinement::RefinedTranscript, String> {
    tracing::info!(
        "Refining full transcript: {} words",
        transcript_text.split_whitespace().count()
    );

    let refinement_agent = RefinementAgent::new(claude_api_key);
    refinement_agent.refine(transcript_text).await
}
