use crate::database::{Database, Recording, RecordingMetadata};
use crate::transcription::commands::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveRecordingRequest {
    pub project_id: String,
    pub name: String,
    pub raw_transcript: String,
    pub enhanced_transcript: String,
    pub summary: Option<String>,
    pub key_points: Vec<String>,
    pub action_items: Vec<String>,
    pub metadata: RecordingMetadata,
}

/// Save the current transcription session as a recording
#[tauri::command]
pub async fn save_recording(
    db: State<'_, Database>,
    request: SaveRecordingRequest,
) -> Result<Recording, String> {
    tracing::info!("Saving recording: {} to project: {}", request.name, request.project_id);

    let mut recording = Recording::new(
        request.project_id,
        request.name,
        request.raw_transcript,
        request.enhanced_transcript,
    );

    recording = recording.with_metadata(request.metadata);

    if let Some(summary) = request.summary {
        recording = recording.with_summary(summary, request.key_points, request.action_items);
    }

    db.create_recording(recording).await
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
pub async fn get_current_project(
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    Ok(state.current_project_id.lock().await.clone())
}

/// Clear the current session
#[tauri::command]
pub async fn clear_current_session(
    state: State<'_, AppState>,
) -> Result<(), String> {
    tracing::info!("Clearing current session");
    state.session_manager.clear_session().await;
    Ok(())
}
