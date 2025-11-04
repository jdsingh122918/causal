use crate::database::{Database, Recording};
use crate::LoggingState;
use crate::transcription::commands::AppState;
use std::sync::Mutex;
use tauri::State;

/// Save the current transcription session as a recording
#[tauri::command]
pub async fn save_recording(
    db: State<'_, Database>,
    state: State<'_, AppState>,
    logging_state: State<'_, Mutex<LoggingState>>,
    name: String,
    summary: Option<String>,
    key_points: Vec<String>,
    action_items: Vec<String>,
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
        project_id,
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

    // Clear the session after successful save
    state.session_manager.clear_session().await;

    Ok(saved)
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
    state: State<'_, AppState>,
    project_id: Option<String>,
) -> Result<(), String> {
    tracing::info!("Setting current project: {:?}", project_id);
    *state.current_project_id.lock().await = project_id;
    Ok(())
}

/// Get the current project ID
#[tauri::command]
pub async fn get_current_project(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state.current_project_id.lock().await.clone())
}

/// Clear the current session
#[tauri::command]
pub async fn clear_current_session(state: State<'_, AppState>) -> Result<(), String> {
    tracing::info!("Clearing current session");
    state.session_manager.clear_session().await;
    Ok(())
}
