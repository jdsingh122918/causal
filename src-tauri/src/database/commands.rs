use super::models::{Project, Recording};
use super::store::Database;
use crate::LoggingState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRecordingRequest {
    pub project_id: String,
    pub name: String,
    pub raw_transcript: String,
    pub enhanced_transcript: String,
    pub summary: Option<String>,
    pub key_points: Vec<String>,
    pub action_items: Vec<String>,
    pub metadata: super::models::RecordingMetadata,
}

// Project commands
#[tauri::command]
pub async fn create_project(
    db: State<'_, Database>,
    logging_state: State<'_, Mutex<LoggingState>>,
    request: CreateProjectRequest,
) -> Result<Project, String> {
    tracing::info!("Creating project: {}", request.name);
    let project = Project::new(request.name, request.description);
    let result = db.create_project(project).await?;

    // Track metrics
    if let Ok(state) = logging_state.lock() {
        state.metrics.project_created();
    }

    Ok(result)
}

#[tauri::command]
pub async fn list_projects(db: State<'_, Database>) -> Result<Vec<Project>, String> {
    tracing::info!("Listing all projects");
    db.list_projects().await
}

#[tauri::command]
pub async fn get_project(db: State<'_, Database>, id: String) -> Result<Project, String> {
    tracing::info!("Getting project: {}", id);
    db.get_project(&id).await
}

#[tauri::command]
pub async fn update_project(
    db: State<'_, Database>,
    id: String,
    request: UpdateProjectRequest,
) -> Result<Project, String> {
    tracing::info!("Updating project: {}", id);
    db.update_project(&id, request.name, request.description)
        .await
}

#[tauri::command]
pub async fn delete_project(db: State<'_, Database>, id: String) -> Result<(), String> {
    tracing::info!("Deleting project: {}", id);
    db.delete_project(&id).await
}

// Recording commands
#[tauri::command]
pub async fn create_recording(
    db: State<'_, Database>,
    request: CreateRecordingRequest,
) -> Result<Recording, String> {
    tracing::info!(
        "Creating recording: {} in project: {}",
        request.name,
        request.project_id
    );

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

#[tauri::command]
pub async fn list_recordings(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<Recording>, String> {
    tracing::info!("Listing recordings for project: {}", project_id);
    db.list_recordings(&project_id).await
}

#[tauri::command]
pub async fn get_recording(db: State<'_, Database>, id: String) -> Result<Recording, String> {
    tracing::info!("Getting recording: {}", id);
    db.get_recording(&id).await
}

#[tauri::command]
pub async fn update_recording_name(
    db: State<'_, Database>,
    id: String,
    name: String,
) -> Result<Recording, String> {
    tracing::info!("Updating recording name: {} to {}", id, name);
    db.update_recording_name(&id, name).await
}

#[tauri::command]
pub async fn delete_recording(db: State<'_, Database>, id: String) -> Result<(), String> {
    tracing::info!("Deleting recording: {}", id);
    db.delete_recording(&id).await
}

// Utility commands
#[tauri::command]
pub async fn get_database_stats(db: State<'_, Database>) -> Result<DatabaseStats, String> {
    let project_count = db.get_project_count().await;
    let recording_count = db.get_recording_count(None).await;

    Ok(DatabaseStats {
        project_count,
        recording_count,
    })
}

/// Generate or regenerate summary for an existing recording
#[tauri::command]
pub async fn generate_recording_summary(
    db: State<'_, Database>,
    recording_id: String,
    claude_api_key: String,
) -> Result<Recording, String> {
    tracing::info!("Generating summary for recording: {}", recording_id);

    // Get the recording
    let mut recording = db.get_recording(&recording_id).await?;

    // Use enhanced transcript if available, otherwise fall back to raw
    let transcript_text = if !recording.enhanced_transcript.is_empty() {
        recording.enhanced_transcript.clone()
    } else {
        recording.raw_transcript.clone()
    };

    // Calculate approximate chunk count from metadata
    let chunk_count = recording.metadata.turn_count.max(1) as u32;

    // Generate summary using the summary service
    let summary_service = crate::transcription::summary::SummaryService::new(claude_api_key);
    let summary = summary_service
        .summarize(transcript_text, chunk_count)
        .await?;

    // Update recording with summary
    recording.summary = Some(summary.summary);
    recording.key_points = summary.key_points;
    recording.action_items = summary.action_items;

    // Save updated recording
    db.update_recording_summary(
        &recording_id,
        recording.summary.clone(),
        recording.key_points.clone(),
        recording.action_items.clone(),
    )
    .await?;

    Ok(recording)
}

#[derive(Debug, Serialize)]
pub struct DatabaseStats {
    pub project_count: usize,
    pub recording_count: usize,
}

/// Export a recording to a text file
#[tauri::command]
pub async fn export_recording(
    db: State<'_, Database>,
    recording_id: String,
    output_path: String,
) -> Result<String, String> {
    // Get the recording
    let recording = db.get_recording(&recording_id).await?;

    // Format the content
    let timestamp = recording
        .created_at
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let created_date = chrono::DateTime::from_timestamp(timestamp, 0)
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    let mut content = format!(
        "RECORDING: {}\nCreated: {}\nDuration: {}s\nWords: {}\n\n",
        recording.name,
        created_date,
        recording.metadata.duration_seconds.round(),
        recording.metadata.word_count
    );

    // Add summary if available
    if let Some(summary) = &recording.summary {
        if !summary.is_empty() {
            content.push_str(&format!("SUMMARY\n{}\n\n", summary));
        }
    }

    // Add key points if available
    if !recording.key_points.is_empty() {
        content.push_str("KEY POINTS\n");
        for point in &recording.key_points {
            content.push_str(&format!("- {}\n", point));
        }
        content.push('\n');
    }

    // Add action items if available
    if !recording.action_items.is_empty() {
        content.push_str("ACTION ITEMS\n");
        for item in &recording.action_items {
            content.push_str(&format!("- {}\n", item));
        }
        content.push('\n');
    }

    // Add enhanced transcript
    content.push_str("ENHANCED TRANSCRIPT\n");
    content.push_str(&recording.enhanced_transcript);
    content.push_str("\n\nRAW TRANSCRIPT\n");
    content.push_str(&recording.raw_transcript);

    // Write to file
    let path = PathBuf::from(&output_path);
    fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(format!("Recording exported to {}", output_path))
}
