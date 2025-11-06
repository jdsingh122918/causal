//! Integration tests for database operations

use causal_lib::database::{models::Project, Database};
use chrono::Utc;
use tempfile::tempdir;

#[tokio::test]
async fn test_database_creation() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("test.db");

    // Database should be created successfully
    let db = Database::new_with_path(&db_path).expect("Failed to create database");

    // Verify database file exists
    assert!(db_path.exists());
}

#[tokio::test]
async fn test_create_project() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new_with_path(&db_path).unwrap();

    let project = Project {
        id: 0, // Will be auto-assigned
        name: "Test Project".to_string(),
        description: "Test Description".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let created = db.create_project(project).await.expect("Failed to create project");

    assert!(created.id > 0);
    assert_eq!(created.name, "Test Project");
    assert_eq!(created.description, "Test Description");
}

#[tokio::test]
async fn test_list_projects() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new_with_path(&db_path).unwrap();

    // Create multiple projects
    for i in 1..=3 {
        let project = Project {
            id: 0,
            name: format!("Project {}", i),
            description: format!("Description {}", i),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        db.create_project(project).await.unwrap();
    }

    let projects = db.list_projects().await.expect("Failed to list projects");

    assert_eq!(projects.len(), 3);
    assert_eq!(projects[0].name, "Project 1");
    assert_eq!(projects[2].name, "Project 3");
}

#[tokio::test]
async fn test_get_project() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new_with_path(&db_path).unwrap();

    let project = Project {
        id: 0,
        name: "Test Project".to_string(),
        description: "Test Description".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let created = db.create_project(project).await.unwrap();
    let retrieved = db.get_project(created.id).await.expect("Failed to get project");

    assert_eq!(retrieved.id, created.id);
    assert_eq!(retrieved.name, created.name);
}

#[tokio::test]
async fn test_update_project() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new_with_path(&db_path).unwrap();

    let project = Project {
        id: 0,
        name: "Original Name".to_string(),
        description: "Original Description".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let created = db.create_project(project).await.unwrap();

    let mut updated_project = created.clone();
    updated_project.name = "Updated Name".to_string();
    updated_project.description = "Updated Description".to_string();

    let result = db.update_project(updated_project).await.expect("Failed to update project");

    assert_eq!(result.name, "Updated Name");
    assert_eq!(result.description, "Updated Description");
}

#[tokio::test]
async fn test_delete_project() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new_with_path(&db_path).unwrap();

    let project = Project {
        id: 0,
        name: "Test Project".to_string(),
        description: "Test Description".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let created = db.create_project(project).await.unwrap();

    db.delete_project(created.id).await.expect("Failed to delete project");

    // Verify project is deleted
    let result = db.get_project(created.id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_project_with_recordings_cascade_delete() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new_with_path(&db_path).unwrap();

    // Create project
    let project = Project {
        id: 0,
        name: "Test Project".to_string(),
        description: "Test Description".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    let created_project = db.create_project(project).await.unwrap();

    // Create recording for the project
    let recording = causal_lib::database::models::Recording {
        id: 0,
        project_id: created_project.id,
        name: "Test Recording".to_string(),
        transcript: Some("Test transcript".to_string()),
        enhanced_transcript: None,
        duration_seconds: Some(60),
        created_at: Utc::now(),
        metadata: None,
    };
    let created_recording = db.create_recording(recording).await.unwrap();

    // Delete project should cascade to recordings
    db.delete_project(created_project.id).await.expect("Failed to delete project");

    // Verify recording is also deleted
    let result = db.get_recording(created_recording.id).await;
    assert!(result.is_err());
}
