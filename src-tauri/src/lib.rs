mod database;
mod transcription;

use database::Database;
use transcription::commands::AppState;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .manage(Database::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            transcription::list_audio_devices,
            transcription::start_transcription,
            transcription::stop_transcription,
            transcription::get_transcription_status,
            transcription::summarize_transcription,
            transcription::refine_transcript,
            // Database commands - Projects
            database::create_project,
            database::list_projects,
            database::get_project,
            database::update_project,
            database::delete_project,
            // Database commands - Recordings
            database::create_recording,
            database::list_recordings,
            database::get_recording,
            database::update_recording_name,
            database::delete_recording,
            database::get_database_stats,
            database::generate_recording_summary,
            // Recording session commands
            transcription::save_recording,
            transcription::get_current_session,
            transcription::set_current_project,
            transcription::get_current_project,
            transcription::clear_current_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
