use crate::database::{Database, Recording, Project};
use crate::LoggingState;
use crate::transcription::commands::AppState;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// Save the current transcription session as a recording
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn save_recording(
    app: AppHandle,
    db: State<'_, Database>,
    state: State<'_, AppState>,
    logging_state: State<'_, Mutex<LoggingState>>,
    name: String,
    summary: Option<String>,
    key_points: Vec<String>,
    action_items: Vec<String>,
    claude_api_key: Option<String>,
    auto_generate_summary: Option<bool>,
) -> Result<Recording, String> {
    // Get current project ID
    let project_id = state
        .current_project_id
        .lock()
        .await
        .clone()
        .ok_or_else(|| "No project selected".to_string())?;

    tracing::info!("Saving recording: {} to project: {}", name, project_id);

    // Get session data from SessionManager
    let session = state
        .session_manager
        .get_session()
        .await
        .ok_or_else(|| "No active session".to_string())?;

    // Convert session data to recording
    let mut recording = Recording::new(
        project_id.clone(),
        name,
        session.raw_transcript,
        session.enhanced_transcript,
    );

    // Use metadata from session
    recording = recording.with_metadata(session.metadata.to_recording_metadata());

    // Add summary if provided
    if let Some(summary_text) = summary {
        recording = recording.with_summary(summary_text, key_points, action_items);
    }

    // Save to database
    let saved = db.create_recording(recording).await?;

    // Track metrics
    if let Ok(log_state) = logging_state.lock() {
        log_state.metrics.recording_saved();
    }

    // Emit real-time event for recording save
    if let Err(e) = app.emit("recording_saved", &saved) {
        tracing::error!("Failed to emit recording_saved event: {}", e);
    }

    // Automatically generate summary if requested and API key is provided
    let final_recording = saved.clone();
    if auto_generate_summary.unwrap_or(false) {
        if let Some(api_key) = claude_api_key {
            if !api_key.trim().is_empty() {
                tracing::info!("Auto-generating summary for recording: {}", saved.id);

                // Spawn async task for summary generation to avoid blocking
                let recording_id = saved.id.clone();
                let app_clone = app.clone();
                let db_inner = db.inner().clone();

                tokio::spawn(async move {
                    // Replicate the summary generation logic from database/commands.rs
                    let result = async {
                        // Get the recording
                        let mut recording = db_inner.get_recording(&recording_id).await?;

                        // Use enhanced transcript if available, otherwise fall back to raw
                        let transcript_text = if !recording.enhanced_transcript.is_empty() {
                            recording.enhanced_transcript.clone()
                        } else {
                            recording.raw_transcript.clone()
                        };

                        // Calculate approximate chunk count from metadata
                        let chunk_count = recording.metadata.turn_count.max(1) as u32;

                        // Generate summary using the summary service
                        let summary_service = crate::transcription::summary::SummaryService::new(api_key.clone());
                        let summary = summary_service
                            .summarize(transcript_text, chunk_count)
                            .await?;

                        // Update recording with summary
                        recording.summary = Some(summary.summary);
                        recording.key_points = summary.key_points;
                        recording.action_items = summary.action_items;

                        // Save updated recording
                        db_inner.update_recording_summary(
                            &recording_id,
                            recording.summary.clone(),
                            recording.key_points.clone(),
                            recording.action_items.clone(),
                        ).await?;

                        Ok::<Recording, String>(recording)
                    }.await;

                    match result {
                        Ok(updated_recording) => {
                            tracing::info!("✅ Auto-summary generated successfully for recording: {}", recording_id);
                            // Emit event for updated recording with summary
                            if let Err(e) = app_clone.emit("recording_summary_generated", &updated_recording) {
                                tracing::error!("Failed to emit recording_summary_generated event: {}", e);
                            }
                        }
                        Err(e) => {
                            tracing::warn!("⚠️ Auto-summary generation failed for recording {}: {}", recording_id, e);
                            // Emit failure event so frontend can show optional manual generation
                            if let Err(emit_err) = app_clone.emit("recording_summary_failed", serde_json::json!({
                                "recording_id": recording_id,
                                "error": e
                            })) {
                                tracing::error!("Failed to emit recording_summary_failed event: {}", emit_err);
                            }
                        }
                    }
                });
            } else {
                tracing::warn!("Auto-summary requested but Claude API key is empty");
            }
        } else {
            tracing::warn!("Auto-summary requested but no Claude API key provided");
        }
    }

    // Clear the session after successful save
    state.session_manager.clear_session().await;

    // Emit session cleared event
    if let Err(e) = app.emit("session_cleared", serde_json::json!({})) {
        tracing::error!("Failed to emit session_cleared event: {}", e);
    }

    Ok(final_recording)
}

/// Get the current session data
#[tauri::command]
pub async fn get_current_session(
    state: State<'_, AppState>,
) -> Result<Option<crate::transcription::session::SessionData>, String> {
    Ok(state.session_manager.get_session().await)
}

/// Set the current project ID
#[tauri::command]
pub async fn set_current_project(
    app: AppHandle,
    state: State<'_, AppState>,
    db: State<'_, Database>,
    project_id: Option<String>,
) -> Result<(), String> {
    tracing::info!("Setting current project: {:?}", project_id);

    // Validate project exists if provided
    if let Some(ref id) = project_id {
        if let Err(e) = db.get_project(id).await {
            return Err(format!("Project {} not found: {}", id, e));
        }
    }

    // Get current project for comparison
    let current_project_id = state.current_project_id.lock().await.clone();

    // Only update and emit event if project actually changed
    if current_project_id != project_id {
        *state.current_project_id.lock().await = project_id.clone();

        // Emit real-time event for project selection change
        if let Err(e) = app.emit("current_project_changed", serde_json::json!({"project_id": project_id})) {
            tracing::error!("Failed to emit current_project_changed event: {}", e);
        }
    }

    Ok(())
}

/// Get the current project
#[tauri::command]
pub async fn get_current_project(
    state: State<'_, AppState>,
    db: State<'_, Database>,
) -> Result<Option<Project>, String> {
    let project_id = state.current_project_id.lock().await.clone();

    if let Some(id) = project_id {
        match db.get_project(&id).await {
            Ok(project) => Ok(Some(project)),
            Err(_) => {
                // Project doesn't exist, clear current project
                tracing::warn!("Current project {} not found, clearing current project", id);
                *state.current_project_id.lock().await = None;
                Ok(None)
            }
        }
    } else {
        Ok(None)
    }
}

/// Clear the current session
#[tauri::command]
pub async fn clear_current_session(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    tracing::info!("Clearing current session");
    state.session_manager.clear_session().await;

    // Emit real-time event for session clear
    if let Err(e) = app.emit("session_cleared", serde_json::json!({})) {
        tracing::error!("Failed to emit session_cleared event: {}", e);
    }

    Ok(())
}
