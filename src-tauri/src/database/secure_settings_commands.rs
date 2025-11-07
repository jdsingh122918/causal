//! # Secure Settings Commands
//!
//! This module provides Tauri commands for managing encrypted settings storage.
//! These commands handle secure API key storage and retrieval using encrypted
//! database storage.

use super::store::Database;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, State};

/// Request structure for saving secure settings
#[derive(Debug, Deserialize)]
pub struct SaveSecureSettingRequest {
    pub key: String,
    pub value: String,
}

/// Request structure for saving multiple secure settings
#[derive(Debug, Deserialize)]
pub struct SaveSecureSettingsRequest {
    pub settings: HashMap<String, String>,
}

/// Response structure for loading secure settings
#[derive(Debug, Serialize)]
pub struct LoadSecureSettingsResponse {
    pub settings: HashMap<String, String>,
}

/// Statistics about secure settings storage
#[derive(Debug, Serialize)]
pub struct SecureSettingsStats {
    pub count: usize,
    pub last_updated: Option<i64>,
}

/// Save a single secure setting (encrypted API key, etc.)
#[tauri::command]
pub async fn save_secure_setting(
    app: AppHandle,
    db: State<'_, Database>,
    request: SaveSecureSettingRequest,
) -> Result<(), String> {
    tracing::info!("Saving secure setting: {}", request.key);

    db.save_secure_setting(&request.key, &request.value).await?;

    // Emit event to notify frontend of settings update
    if let Err(e) = app.emit("secure_setting_saved", serde_json::json!({
        "key": request.key
    })) {
        tracing::warn!("Failed to emit secure_setting_saved event: {}", e);
    }

    Ok(())
}

/// Load a single secure setting by key
#[tauri::command]
pub async fn load_secure_setting(
    db: State<'_, Database>,
    key: String,
) -> Result<Option<String>, String> {
    tracing::info!("Loading secure setting: {}", key);

    db.load_secure_setting(&key).await
}

/// Load all secure settings
#[tauri::command]
pub async fn load_all_secure_settings(
    db: State<'_, Database>,
) -> Result<LoadSecureSettingsResponse, String> {
    tracing::info!("Loading all secure settings");

    let settings = db.load_all_secure_settings().await?;

    Ok(LoadSecureSettingsResponse { settings })
}

/// Save multiple secure settings in a batch operation
#[tauri::command]
pub async fn save_secure_settings_batch(
    app: AppHandle,
    db: State<'_, Database>,
    request: SaveSecureSettingsRequest,
) -> Result<(), String> {
    tracing::info!("Saving {} secure settings in batch", request.settings.len());

    // Save each setting individually
    for (key, value) in request.settings.iter() {
        db.save_secure_setting(key, value).await?;
    }

    // Emit event to notify frontend of settings update
    if let Err(e) = app.emit("secure_settings_saved", serde_json::json!({
        "count": request.settings.len(),
        "keys": request.settings.keys().collect::<Vec<_>>()
    })) {
        tracing::warn!("Failed to emit secure_settings_saved event: {}", e);
    }

    Ok(())
}

/// Delete a secure setting by key
#[tauri::command]
pub async fn delete_secure_setting(
    app: AppHandle,
    db: State<'_, Database>,
    key: String,
) -> Result<bool, String> {
    tracing::info!("Deleting secure setting: {}", key);

    let deleted = db.delete_secure_setting(&key).await?;

    if deleted {
        // Emit event to notify frontend of setting deletion
        if let Err(e) = app.emit("secure_setting_deleted", serde_json::json!({
            "key": key
        })) {
            tracing::warn!("Failed to emit secure_setting_deleted event: {}", e);
        }
    }

    Ok(deleted)
}

/// Clear all secure settings (with confirmation)
#[tauri::command]
pub async fn clear_all_secure_settings(
    app: AppHandle,
    db: State<'_, Database>,
    confirmation: bool,
) -> Result<usize, String> {
    if !confirmation {
        return Err("Confirmation required to clear all secure settings".to_string());
    }

    tracing::warn!("Clearing ALL secure settings");

    let count = db.clear_all_secure_settings().await?;

    // Emit event to notify frontend
    if let Err(e) = app.emit("secure_settings_cleared", serde_json::json!({
        "count": count
    })) {
        tracing::warn!("Failed to emit secure_settings_cleared event: {}", e);
    }

    Ok(count)
}

/// Get statistics about secure settings storage
#[tauri::command]
pub async fn get_secure_settings_stats(
    db: State<'_, Database>,
) -> Result<SecureSettingsStats, String> {
    tracing::info!("Getting secure settings statistics");

    // We need to add this method to the Database struct since connection is private
    db.get_secure_settings_stats().await
}

/// Check if a specific secure setting exists
#[tauri::command]
pub async fn secure_setting_exists(
    db: State<'_, Database>,
    key: String,
) -> Result<bool, String> {
    tracing::debug!("Checking if secure setting exists: {}", key);

    // Use the existing load function and check if it returns Some
    let setting = db.load_secure_setting(&key).await?;
    Ok(setting.is_some())
}

/// Get list of all secure setting keys (without values)
#[tauri::command]
pub async fn list_secure_setting_keys(
    db: State<'_, Database>,
) -> Result<Vec<String>, String> {
    tracing::info!("Listing secure setting keys");

    // We need to add this method to the Database struct since connection is private
    db.list_secure_setting_keys().await
}

// Project-specific API key management functions

/// Save an API key for a specific project
#[tauri::command]
pub async fn save_project_api_key(
    app: AppHandle,
    db: State<'_, Database>,
    project_id: String,
    api_key: String,
) -> Result<(), String> {
    tracing::info!("Saving API key for project: {}", project_id);

    // Validate inputs
    if project_id.is_empty() {
        return Err("Project ID cannot be empty".to_string());
    }

    if api_key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let secure_key = format!("project_{}_api_key", project_id);

    // Save the API key using existing secure settings infrastructure
    db.save_secure_setting(&secure_key, &api_key).await?;

    // Update the project's api_key_reference field
    db.update_project_api_key_reference(&project_id, Some(secure_key.clone())).await?;

    // Emit event to notify frontend of API key save
    if let Err(e) = app.emit("project_api_key_saved", serde_json::json!({
        "project_id": project_id,
        "secure_key": secure_key
    })) {
        tracing::warn!("Failed to emit project_api_key_saved event: {}", e);
    }

    Ok(())
}

/// Load an API key for a specific project
#[tauri::command]
pub async fn load_project_api_key(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Option<String>, String> {
    tracing::info!("Loading API key for project: {}", project_id);

    if project_id.is_empty() {
        return Err("Project ID cannot be empty".to_string());
    }

    let secure_key = format!("project_{}_api_key", project_id);

    // Load the API key using existing secure settings infrastructure
    db.load_secure_setting(&secure_key).await
}

/// Delete an API key for a specific project
#[tauri::command]
pub async fn delete_project_api_key(
    app: AppHandle,
    db: State<'_, Database>,
    project_id: String,
) -> Result<bool, String> {
    tracing::info!("Deleting API key for project: {}", project_id);

    if project_id.is_empty() {
        return Err("Project ID cannot be empty".to_string());
    }

    let secure_key = format!("project_{}_api_key", project_id);

    // Delete the API key from secure settings
    let deleted = db.delete_secure_setting(&secure_key).await?;

    if deleted {
        // Clear the project's api_key_reference field
        db.update_project_api_key_reference(&project_id, None).await?;

        // Emit event to notify frontend of API key deletion
        if let Err(e) = app.emit("project_api_key_deleted", serde_json::json!({
            "project_id": project_id,
            "secure_key": secure_key
        })) {
            tracing::warn!("Failed to emit project_api_key_deleted event: {}", e);
        }
    }

    Ok(deleted)
}

/// Check if a specific project has an API key configured
#[tauri::command]
pub async fn project_api_key_exists(
    db: State<'_, Database>,
    project_id: String,
) -> Result<bool, String> {
    tracing::debug!("Checking if API key exists for project: {}", project_id);

    if project_id.is_empty() {
        return Err("Project ID cannot be empty".to_string());
    }

    let secure_key = format!("project_{}_api_key", project_id);

    // Check if the API key exists using existing secure settings infrastructure
    let api_key = db.load_secure_setting(&secure_key).await?;
    Ok(api_key.is_some())
}