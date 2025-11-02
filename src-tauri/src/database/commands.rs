use super::models::{Project, Recording};
use super::store::Database;
use serde::{Deserialize, Serialize};
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
    request: CreateProjectRequest,
) -> Result<Project, String> {
    tracing::info!("Creating project: {}", request.name);
    let project = Project::new(request.name, request.description);
    db.create_project(project).await
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
    tracing::info!("Creating recording: {} in project: {}", request.name, request.project_id);

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

#[derive(Debug, Serialize)]
pub struct DatabaseStats {
    pub project_count: usize,
    pub recording_count: usize,
}
