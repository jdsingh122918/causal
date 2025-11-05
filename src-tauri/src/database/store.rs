use super::models::{Project, Recording, RecordingStatus};
use rusqlite::{params, Connection, Result as SqlResult};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::Mutex;

#[derive(Debug, Clone)]
pub struct Database {
    connection: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new() -> Result<Self, String> {
        // Get app data directory
        let db_path = Self::get_db_path()?;

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create database directory: {}", e))?;
        }

        let conn =
            Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        let db = Self {
            connection: Arc::new(Mutex::new(conn)),
        };

        // Initialize schema
        db.init_schema()?;

        Ok(db)
    }

    fn get_db_path() -> Result<PathBuf, String> {
        // For now, use a simple path in the home directory
        // In a real deployment, we'd get the proper app data directory from Tauri's AppHandle
        let home_dir = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map_err(|_| "Failed to get home directory".to_string())?;

        let app_data_dir = PathBuf::from(home_dir).join(".causal");
        Ok(app_data_dir.join("causal.db"))
    }

    fn init_schema(&self) -> Result<(), String> {
        // Try to get lock - works in both sync and async contexts
        let conn = self
            .connection
            .try_lock()
            .map_err(|_| "Failed to acquire lock for schema initialization".to_string())?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create projects table: {}", e))?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS recordings (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                raw_transcript TEXT NOT NULL,
                enhanced_transcript TEXT NOT NULL,
                summary TEXT,
                key_points TEXT NOT NULL,
                action_items TEXT NOT NULL,
                metadata_duration_seconds REAL NOT NULL,
                metadata_word_count INTEGER NOT NULL,
                metadata_chunk_count INTEGER NOT NULL,
                metadata_turn_count INTEGER NOT NULL,
                metadata_average_confidence REAL NOT NULL,
                status TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create recordings table: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_recordings_project_id ON recordings(project_id)",
            [],
        )
        .map_err(|e| format!("Failed to create index: {}", e))?;

        // Apply database performance optimizations
        // Note: Some PRAGMA statements return values, so we need to handle them properly

        // Try to enable WAL mode for better concurrency (may not work for in-memory DBs)
        if let Err(e) = conn.execute("PRAGMA journal_mode=WAL", []) {
            // WAL mode failed (probably in-memory database), log but continue
            tracing::debug!("WAL mode not available: {}", e);
        }

        // Set synchronous mode to NORMAL for better performance while maintaining safety
        conn.execute("PRAGMA synchronous=NORMAL", [])
            .map_err(|e| format!("Failed to set synchronous mode: {}", e))?;

        // Increase cache size to 64MB for better performance
        conn.execute("PRAGMA cache_size=-65536", [])
            .map_err(|e| format!("Failed to set cache size: {}", e))?;

        // Enable foreign key constraints
        conn.execute("PRAGMA foreign_keys=ON", [])
            .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

        // Set temp store to memory for faster temporary operations
        conn.execute("PRAGMA temp_store=MEMORY", [])
            .map_err(|e| format!("Failed to set temp store: {}", e))?;

        Ok(())
    }

    // Helper to convert SystemTime to timestamp
    fn system_time_to_timestamp(time: SystemTime) -> i64 {
        time.duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64
    }

    // Helper to convert timestamp to SystemTime
    fn timestamp_to_system_time(timestamp: i64) -> SystemTime {
        SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(timestamp as u64)
    }

    // Project operations
    pub async fn create_project(&self, project: Project) -> Result<Project, String> {
        let conn = self.connection.lock().await;

        conn.execute(
            "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                project.id,
                project.name,
                project.description,
                Self::system_time_to_timestamp(project.created_at),
                Self::system_time_to_timestamp(project.updated_at),
            ],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                "Project with this name already exists".to_string()
            } else {
                format!("Failed to create project: {}", e)
            }
        })?;

        Ok(project)
    }

    pub async fn get_project(&self, id: &str) -> Result<Project, String> {
        let conn = self.connection.lock().await;

        let mut stmt = conn
            .prepare(
                "SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?1",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let project = stmt
            .query_row(params![id], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    created_at: Self::timestamp_to_system_time(row.get(3)?),
                    updated_at: Self::timestamp_to_system_time(row.get(4)?),
                })
            })
            .map_err(|_| "Project not found".to_string())?;

        Ok(project)
    }

    pub async fn list_projects(&self) -> Result<Vec<Project>, String> {
        let conn = self.connection.lock().await;

        let mut stmt = conn
            .prepare("SELECT id, name, description, created_at, updated_at FROM projects ORDER BY created_at DESC")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let projects = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    created_at: Self::timestamp_to_system_time(row.get(3)?),
                    updated_at: Self::timestamp_to_system_time(row.get(4)?),
                })
            })
            .map_err(|e| format!("Failed to query projects: {}", e))?
            .collect::<SqlResult<Vec<_>>>()
            .map_err(|e| format!("Failed to collect projects: {}", e))?;

        Ok(projects)
    }

    pub async fn update_project(
        &self,
        id: &str,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<Project, String> {
        let conn = self.connection.lock().await;

        // First check if project exists
        let exists: bool = conn
            .query_row("SELECT 1 FROM projects WHERE id = ?1", params![id], |_| {
                Ok(true)
            })
            .unwrap_or(false);

        if !exists {
            return Err("Project not found".to_string());
        }

        let now = Self::system_time_to_timestamp(SystemTime::now());

        if let Some(new_name) = &name {
            conn.execute(
                "UPDATE projects SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_name, now, id],
            )
            .map_err(|e| {
                if e.to_string().contains("UNIQUE constraint failed") {
                    "Project with this name already exists".to_string()
                } else {
                    format!("Failed to update project: {}", e)
                }
            })?;
        }

        if let Some(new_description) = &description {
            conn.execute(
                "UPDATE projects SET description = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_description, now, id],
            )
            .map_err(|e| format!("Failed to update project: {}", e))?;
        }

        drop(conn);
        self.get_project(id).await
    }

    pub async fn delete_project(&self, id: &str) -> Result<(), String> {
        let conn = self.connection.lock().await;

        // Check if project exists
        let exists: bool = conn
            .query_row("SELECT 1 FROM projects WHERE id = ?1", params![id], |_| {
                Ok(true)
            })
            .unwrap_or(false);

        if !exists {
            return Err("Project not found".to_string());
        }

        // SQLite will cascade delete recordings automatically
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to delete project: {}", e))?;

        Ok(())
    }

    // Recording operations
    pub async fn create_recording(&self, recording: Recording) -> Result<Recording, String> {
        let conn = self.connection.lock().await;

        // Verify project exists
        let project_exists: bool = conn
            .query_row(
                "SELECT 1 FROM projects WHERE id = ?1",
                params![recording.project_id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !project_exists {
            return Err("Project not found".to_string());
        }

        let key_points_json = serde_json::to_string(&recording.key_points)
            .map_err(|e| format!("Failed to serialize key_points: {}", e))?;
        let action_items_json = serde_json::to_string(&recording.action_items)
            .map_err(|e| format!("Failed to serialize action_items: {}", e))?;
        let status_str = match recording.status {
            RecordingStatus::Recording => "Recording",
            RecordingStatus::Processing => "Processing",
            RecordingStatus::Completed => "Completed",
            RecordingStatus::Failed => "Failed",
        };

        conn.execute(
            "INSERT INTO recordings (
                id, project_id, name, raw_transcript, enhanced_transcript, summary,
                key_points, action_items, metadata_duration_seconds, metadata_word_count,
                metadata_chunk_count, metadata_turn_count, metadata_average_confidence,
                status, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                recording.id,
                recording.project_id,
                recording.name,
                recording.raw_transcript,
                recording.enhanced_transcript,
                recording.summary,
                key_points_json,
                action_items_json,
                recording.metadata.duration_seconds,
                recording.metadata.word_count as i64,
                recording.metadata.chunk_count as i64,
                recording.metadata.turn_count as i64,
                recording.metadata.average_confidence,
                status_str,
                Self::system_time_to_timestamp(recording.created_at),
            ],
        )
        .map_err(|e| format!("Failed to create recording: {}", e))?;

        Ok(recording)
    }

    pub async fn get_recording(&self, id: &str) -> Result<Recording, String> {
        let conn = self.connection.lock().await;

        let mut stmt = conn
            .prepare(
                "SELECT id, project_id, name, raw_transcript, enhanced_transcript, summary,
                 key_points, action_items, metadata_duration_seconds, metadata_word_count,
                 metadata_chunk_count, metadata_turn_count, metadata_average_confidence,
                 status, created_at FROM recordings WHERE id = ?1",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let recording = stmt
            .query_row(params![id], |row| {
                let key_points_json: String = row.get(6)?;
                let action_items_json: String = row.get(7)?;
                let status_str: String = row.get(13)?;

                let key_points: Vec<String> =
                    serde_json::from_str(&key_points_json).unwrap_or_default();
                let action_items: Vec<String> =
                    serde_json::from_str(&action_items_json).unwrap_or_default();
                let status = match status_str.as_str() {
                    "Recording" => RecordingStatus::Recording,
                    "Processing" => RecordingStatus::Processing,
                    "Completed" => RecordingStatus::Completed,
                    "Failed" => RecordingStatus::Failed,
                    _ => RecordingStatus::Completed,
                };

                Ok(Recording {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    raw_transcript: row.get(3)?,
                    enhanced_transcript: row.get(4)?,
                    summary: row.get(5)?,
                    key_points,
                    action_items,
                    metadata: super::models::RecordingMetadata {
                        duration_seconds: row.get(8)?,
                        word_count: row.get::<_, i64>(9)? as usize,
                        chunk_count: row.get::<_, i64>(10)? as usize,
                        turn_count: row.get::<_, i64>(11)? as usize,
                        average_confidence: row.get(12)?,
                    },
                    status,
                    created_at: Self::timestamp_to_system_time(row.get(14)?),
                })
            })
            .map_err(|_| "Recording not found".to_string())?;

        Ok(recording)
    }

    pub async fn list_recordings(&self, project_id: &str) -> Result<Vec<Recording>, String> {
        let conn = self.connection.lock().await;

        // Verify project exists
        let project_exists: bool = conn
            .query_row(
                "SELECT 1 FROM projects WHERE id = ?1",
                params![project_id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !project_exists {
            return Err("Project not found".to_string());
        }

        let mut stmt = conn
            .prepare(
                "SELECT id, project_id, name, raw_transcript, enhanced_transcript, summary,
                 key_points, action_items, metadata_duration_seconds, metadata_word_count,
                 metadata_chunk_count, metadata_turn_count, metadata_average_confidence,
                 status, created_at FROM recordings WHERE project_id = ?1 ORDER BY created_at DESC",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let recordings = stmt
            .query_map(params![project_id], |row| {
                let key_points_json: String = row.get(6)?;
                let action_items_json: String = row.get(7)?;
                let status_str: String = row.get(13)?;

                let key_points: Vec<String> =
                    serde_json::from_str(&key_points_json).unwrap_or_default();
                let action_items: Vec<String> =
                    serde_json::from_str(&action_items_json).unwrap_or_default();
                let status = match status_str.as_str() {
                    "Recording" => RecordingStatus::Recording,
                    "Processing" => RecordingStatus::Processing,
                    "Completed" => RecordingStatus::Completed,
                    "Failed" => RecordingStatus::Failed,
                    _ => RecordingStatus::Completed,
                };

                Ok(Recording {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    raw_transcript: row.get(3)?,
                    enhanced_transcript: row.get(4)?,
                    summary: row.get(5)?,
                    key_points,
                    action_items,
                    metadata: super::models::RecordingMetadata {
                        duration_seconds: row.get(8)?,
                        word_count: row.get::<_, i64>(9)? as usize,
                        chunk_count: row.get::<_, i64>(10)? as usize,
                        turn_count: row.get::<_, i64>(11)? as usize,
                        average_confidence: row.get(12)?,
                    },
                    status,
                    created_at: Self::timestamp_to_system_time(row.get(14)?),
                })
            })
            .map_err(|e| format!("Failed to query recordings: {}", e))?
            .collect::<SqlResult<Vec<_>>>()
            .map_err(|e| format!("Failed to collect recordings: {}", e))?;

        Ok(recordings)
    }

    pub async fn update_recording_name(&self, id: &str, name: String) -> Result<Recording, String> {
        let conn = self.connection.lock().await;

        conn.execute(
            "UPDATE recordings SET name = ?1 WHERE id = ?2",
            params![name, id],
        )
        .map_err(|e| format!("Failed to update recording: {}", e))?;

        drop(conn);
        self.get_recording(id).await
    }

    pub async fn update_recording_summary(
        &self,
        id: &str,
        summary: Option<String>,
        key_points: Vec<String>,
        action_items: Vec<String>,
    ) -> Result<(), String> {
        let conn = self.connection.lock().await;

        let key_points_json = serde_json::to_string(&key_points)
            .map_err(|e| format!("Failed to serialize key_points: {}", e))?;
        let action_items_json = serde_json::to_string(&action_items)
            .map_err(|e| format!("Failed to serialize action_items: {}", e))?;

        conn.execute(
            "UPDATE recordings SET summary = ?1, key_points = ?2, action_items = ?3 WHERE id = ?4",
            params![summary, key_points_json, action_items_json, id],
        )
        .map_err(|e| format!("Failed to update recording: {}", e))?;

        Ok(())
    }

    pub async fn delete_recording(&self, id: &str) -> Result<(), String> {
        let conn = self.connection.lock().await;

        let rows_affected = conn
            .execute("DELETE FROM recordings WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to delete recording: {}", e))?;

        if rows_affected == 0 {
            return Err("Recording not found".to_string());
        }

        Ok(())
    }

    // Utility methods
    pub async fn get_project_count(&self) -> usize {
        let conn = self.connection.lock().await;

        conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
            .unwrap_or(0)
    }

    pub async fn get_recording_count(&self, project_id: Option<&str>) -> usize {
        let conn = self.connection.lock().await;

        if let Some(pid) = project_id {
            conn.query_row(
                "SELECT COUNT(*) FROM recordings WHERE project_id = ?1",
                params![pid],
                |row| row.get(0),
            )
            .unwrap_or(0)
        } else {
            conn.query_row("SELECT COUNT(*) FROM recordings", [], |row| row.get(0))
                .unwrap_or(0)
        }
    }
}

impl Default for Database {
    fn default() -> Self {
        match Self::new() {
            Ok(db) => db,
            Err(e) => {
                eprintln!("Critical error: Failed to create default database: {}", e);
                panic!("Failed to create default database: {}", e);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::models::Project;

    fn test_db() -> Database {
        // Use in-memory database for tests
        let conn = Connection::open_in_memory().unwrap();
        let db = Database {
            connection: Arc::new(Mutex::new(conn)),
        };
        db.init_schema().unwrap();
        db
    }

    #[tokio::test]
    async fn test_create_and_get_project() {
        let db = test_db();
        let project = Project::new("Test Project".to_string(), "A test".to_string());
        let project_id = project.id.clone();

        let created = db.create_project(project).await.unwrap();
        assert_eq!(created.name, "Test Project");

        let retrieved = db.get_project(&project_id).await.unwrap();
        assert_eq!(retrieved.name, "Test Project");
    }

    #[tokio::test]
    async fn test_list_projects() {
        let db = test_db();

        db.create_project(Project::new("Project 1".to_string(), "".to_string()))
            .await
            .unwrap();
        db.create_project(Project::new("Project 2".to_string(), "".to_string()))
            .await
            .unwrap();

        let projects = db.list_projects().await.unwrap();
        assert_eq!(projects.len(), 2);
    }

    #[tokio::test]
    async fn test_duplicate_project_name() {
        let db = test_db();

        db.create_project(Project::new("Duplicate".to_string(), "First".to_string()))
            .await
            .unwrap();

        let result = db
            .create_project(Project::new("Duplicate".to_string(), "Second".to_string()))
            .await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Project with this name already exists");
    }
}
