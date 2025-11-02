use super::models::{Project, Recording};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct Database {
    projects: Arc<RwLock<HashMap<String, Project>>>,
    recordings: Arc<RwLock<HashMap<String, Recording>>>,
    // Index for fast lookup of recordings by project
    recordings_by_project: Arc<RwLock<HashMap<String, Vec<String>>>>,
}

impl Database {
    pub fn new() -> Self {
        Self {
            projects: Arc::new(RwLock::new(HashMap::new())),
            recordings: Arc::new(RwLock::new(HashMap::new())),
            recordings_by_project: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // Project operations
    pub async fn create_project(&self, project: Project) -> Result<Project, String> {
        let mut projects = self.projects.write().await;

        // Check if project with same name already exists
        if projects.values().any(|p| p.name == project.name) {
            return Err("Project with this name already exists".to_string());
        }

        projects.insert(project.id.clone(), project.clone());
        Ok(project)
    }

    pub async fn get_project(&self, id: &str) -> Result<Project, String> {
        let projects = self.projects.read().await;
        projects
            .get(id)
            .cloned()
            .ok_or_else(|| "Project not found".to_string())
    }

    pub async fn list_projects(&self) -> Result<Vec<Project>, String> {
        let projects = self.projects.read().await;
        let mut project_list: Vec<Project> = projects.values().cloned().collect();

        // Sort by created_at (newest first)
        project_list.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(project_list)
    }

    pub async fn update_project(
        &self,
        id: &str,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<Project, String> {
        let mut projects = self.projects.write().await;

        // Check if project exists
        if !projects.contains_key(id) {
            return Err("Project not found".to_string());
        }

        // Check if new name conflicts with another project
        if let Some(ref new_name) = name {
            if projects.values().any(|p| p.id != id && p.name == *new_name) {
                return Err("Project with this name already exists".to_string());
            }
        }

        // Now we can safely get mutable reference and update
        let project = projects.get_mut(id).unwrap(); // Safe because we checked above

        if let Some(new_name) = name {
            project.name = new_name;
        }

        if let Some(new_description) = description {
            project.description = new_description;
        }

        project.updated_at = std::time::SystemTime::now();

        Ok(project.clone())
    }

    pub async fn delete_project(&self, id: &str) -> Result<(), String> {
        let mut projects = self.projects.write().await;
        let mut recordings = self.recordings.write().await;
        let mut recordings_by_project = self.recordings_by_project.write().await;

        // Check if project exists
        if !projects.contains_key(id) {
            return Err("Project not found".to_string());
        }

        // Delete all recordings in this project
        if let Some(recording_ids) = recordings_by_project.remove(id) {
            for recording_id in recording_ids {
                recordings.remove(&recording_id);
            }
        }

        // Delete the project
        projects.remove(id);

        Ok(())
    }

    // Recording operations
    pub async fn create_recording(&self, recording: Recording) -> Result<Recording, String> {
        let mut recordings = self.recordings.write().await;
        let mut recordings_by_project = self.recordings_by_project.write().await;

        // Verify project exists
        let projects = self.projects.read().await;
        if !projects.contains_key(&recording.project_id) {
            return Err("Project not found".to_string());
        }
        drop(projects);

        // Store recording
        recordings.insert(recording.id.clone(), recording.clone());

        // Update index
        recordings_by_project
            .entry(recording.project_id.clone())
            .or_insert_with(Vec::new)
            .push(recording.id.clone());

        Ok(recording)
    }

    pub async fn get_recording(&self, id: &str) -> Result<Recording, String> {
        let recordings = self.recordings.read().await;
        recordings
            .get(id)
            .cloned()
            .ok_or_else(|| "Recording not found".to_string())
    }

    pub async fn list_recordings(&self, project_id: &str) -> Result<Vec<Recording>, String> {
        let recordings = self.recordings.read().await;
        let recordings_by_project = self.recordings_by_project.read().await;

        // Verify project exists
        let projects = self.projects.read().await;
        if !projects.contains_key(project_id) {
            return Err("Project not found".to_string());
        }
        drop(projects);

        let recording_ids = recordings_by_project
            .get(project_id)
            .cloned()
            .unwrap_or_default();

        let mut recording_list: Vec<Recording> = recording_ids
            .iter()
            .filter_map(|id| recordings.get(id).cloned())
            .collect();

        // Sort by created_at (newest first)
        recording_list.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(recording_list)
    }

    pub async fn update_recording_name(&self, id: &str, name: String) -> Result<Recording, String> {
        let mut recordings = self.recordings.write().await;

        let recording = recordings
            .get_mut(id)
            .ok_or_else(|| "Recording not found".to_string())?;

        recording.name = name;

        Ok(recording.clone())
    }

    pub async fn delete_recording(&self, id: &str) -> Result<(), String> {
        let mut recordings = self.recordings.write().await;
        let mut recordings_by_project = self.recordings_by_project.write().await;

        // Get the recording to find its project_id
        let recording = recordings
            .get(id)
            .ok_or_else(|| "Recording not found".to_string())?;

        let project_id = recording.project_id.clone();

        // Remove from recordings map
        recordings.remove(id);

        // Remove from index
        if let Some(recording_ids) = recordings_by_project.get_mut(&project_id) {
            recording_ids.retain(|rid| rid != id);
        }

        Ok(())
    }

    // Utility methods
    pub async fn get_project_count(&self) -> usize {
        let projects = self.projects.read().await;
        projects.len()
    }

    pub async fn get_recording_count(&self, project_id: Option<&str>) -> usize {
        let recordings_by_project = self.recordings_by_project.read().await;

        if let Some(pid) = project_id {
            recordings_by_project
                .get(pid)
                .map(|ids| ids.len())
                .unwrap_or(0)
        } else {
            let recordings = self.recordings.read().await;
            recordings.len()
        }
    }
}

impl Default for Database {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_and_get_project() {
        let db = Database::new();
        let project = Project::new("Test Project".to_string(), "A test".to_string());
        let project_id = project.id.clone();

        let created = db.create_project(project).await.unwrap();
        assert_eq!(created.name, "Test Project");

        let retrieved = db.get_project(&project_id).await.unwrap();
        assert_eq!(retrieved.name, "Test Project");
    }

    #[tokio::test]
    async fn test_list_projects() {
        let db = Database::new();

        db.create_project(Project::new("Project 1".to_string(), "".to_string())).await.unwrap();
        db.create_project(Project::new("Project 2".to_string(), "".to_string())).await.unwrap();

        let projects = db.list_projects().await.unwrap();
        assert_eq!(projects.len(), 2);
    }

    #[tokio::test]
    async fn test_create_and_list_recordings() {
        let db = Database::new();
        let project = db.create_project(Project::new("Test".to_string(), "".to_string())).await.unwrap();

        let recording = Recording::new(
            project.id.clone(),
            "Recording 1".to_string(),
            "raw".to_string(),
            "enhanced".to_string(),
        );

        db.create_recording(recording).await.unwrap();

        let recordings = db.list_recordings(&project.id).await.unwrap();
        assert_eq!(recordings.len(), 1);
        assert_eq!(recordings[0].name, "Recording 1");
    }

    #[tokio::test]
    async fn test_duplicate_project_name() {
        let db = Database::new();

        db.create_project(Project::new("Duplicate".to_string(), "First".to_string()))
            .await
            .unwrap();

        let result = db.create_project(Project::new("Duplicate".to_string(), "Second".to_string())).await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Project with this name already exists");
    }

    #[tokio::test]
    async fn test_update_project() {
        let db = Database::new();
        let project = db.create_project(Project::new("Original".to_string(), "Desc".to_string()))
            .await
            .unwrap();

        let updated = db.update_project(
            &project.id,
            Some("Updated".to_string()),
            Some("New description".to_string()),
        )
        .await
        .unwrap();

        assert_eq!(updated.name, "Updated");
        assert_eq!(updated.description, "New description");
    }

    #[tokio::test]
    async fn test_delete_project_cascades_recordings() {
        let db = Database::new();
        let project = db.create_project(Project::new("To Delete".to_string(), "".to_string()))
            .await
            .unwrap();

        // Create a recording
        let recording = Recording::new(
            project.id.clone(),
            "Recording".to_string(),
            "raw".to_string(),
            "enhanced".to_string(),
        );
        db.create_recording(recording).await.unwrap();

        // Verify recording exists
        let recordings = db.list_recordings(&project.id).await.unwrap();
        assert_eq!(recordings.len(), 1);

        // Delete project
        db.delete_project(&project.id).await.unwrap();

        // Verify project is gone
        let result = db.get_project(&project.id).await;
        assert!(result.is_err());

        // Verify recording count is 0
        assert_eq!(db.get_recording_count(None).await, 0);
    }

    #[tokio::test]
    async fn test_delete_recording() {
        let db = Database::new();
        let project = db.create_project(Project::new("Test".to_string(), "".to_string()))
            .await
            .unwrap();

        let recording = Recording::new(
            project.id.clone(),
            "Recording".to_string(),
            "raw".to_string(),
            "enhanced".to_string(),
        );
        let created = db.create_recording(recording).await.unwrap();

        // Delete recording
        db.delete_recording(&created.id).await.unwrap();

        // Verify it's gone
        let recordings = db.list_recordings(&project.id).await.unwrap();
        assert_eq!(recordings.len(), 0);
    }

    #[tokio::test]
    async fn test_update_recording_name() {
        let db = Database::new();
        let project = db.create_project(Project::new("Test".to_string(), "".to_string()))
            .await
            .unwrap();

        let recording = Recording::new(
            project.id.clone(),
            "Original Name".to_string(),
            "raw".to_string(),
            "enhanced".to_string(),
        );
        let created = db.create_recording(recording).await.unwrap();

        let updated = db.update_recording_name(&created.id, "New Name".to_string())
            .await
            .unwrap();

        assert_eq!(updated.name, "New Name");
    }

    #[tokio::test]
    async fn test_database_stats() {
        let db = Database::new();

        let project1 = db.create_project(Project::new("P1".to_string(), "".to_string()))
            .await
            .unwrap();
        let project2 = db.create_project(Project::new("P2".to_string(), "".to_string()))
            .await
            .unwrap();

        let rec1 = Recording::new(project1.id.clone(), "R1".to_string(), "".to_string(), "".to_string());
        let rec2 = Recording::new(project1.id.clone(), "R2".to_string(), "".to_string(), "".to_string());
        let rec3 = Recording::new(project2.id.clone(), "R3".to_string(), "".to_string(), "".to_string());

        db.create_recording(rec1).await.unwrap();
        db.create_recording(rec2).await.unwrap();
        db.create_recording(rec3).await.unwrap();

        assert_eq!(db.get_project_count().await, 2);
        assert_eq!(db.get_recording_count(None).await, 3);
        assert_eq!(db.get_recording_count(Some(&project1.id)).await, 2);
        assert_eq!(db.get_recording_count(Some(&project2.id)).await, 1);
    }

    #[tokio::test]
    async fn test_recording_metadata() {
        let db = Database::new();
        let project = db.create_project(Project::new("Test".to_string(), "".to_string()))
            .await
            .unwrap();

        let metadata = super::super::models::RecordingMetadata {
            duration_seconds: 120.5,
            word_count: 250,
            chunk_count: 12,
            turn_count: 15,
            average_confidence: 0.95,
        };

        let recording = Recording::new(
            project.id.clone(),
            "Test Recording".to_string(),
            "raw transcript".to_string(),
            "enhanced transcript".to_string(),
        )
        .with_metadata(metadata.clone());

        let created = db.create_recording(recording).await.unwrap();

        assert_eq!(created.metadata.duration_seconds, 120.5);
        assert_eq!(created.metadata.word_count, 250);
        assert_eq!(created.metadata.chunk_count, 12);
        assert_eq!(created.metadata.turn_count, 15);
        assert_eq!(created.metadata.average_confidence, 0.95);
    }
}
