/**
 * Tauri API wrapper utilities
 * This file provides typed wrappers around Tauri commands for better type safety and error handling
 */

import { invoke } from "@tauri-apps/api/core";
import {
  AudioDevice,
  Project,
  CreateProjectRequest,
  Recording,
  TranscriptSummary,
  AppSettings,
} from "./types";

// Audio Device Commands
export async function listAudioDevices(): Promise<AudioDevice[]> {
  return await invoke<AudioDevice[]>("list_audio_devices");
}

// Project Commands
export async function listProjects(): Promise<Project[]> {
  return await invoke<Project[]>("list_projects");
}

export async function createProject(
  request: CreateProjectRequest,
): Promise<Project> {
  return await invoke<Project>("create_project", { request });
}

export async function selectProject(projectId: string): Promise<void> {
  return await invoke("select_project", { projectId });
}

export async function deleteProject(projectId: string): Promise<void> {
  return await invoke("delete_project", { projectId });
}

export async function getCurrentProject(): Promise<Project> {
  return await invoke<Project>("get_current_project");
}

// Recording Commands
export async function listRecordings(projectId: string): Promise<Recording[]> {
  return await invoke<Recording[]>("list_recordings", { projectId });
}

export async function saveRecording(
  projectId: string,
  name: string,
  transcript: string,
): Promise<Recording> {
  return await invoke<Recording>("save_recording", {
    projectId,
    name,
    transcript,
  });
}

export async function renameRecording(
  recordingId: string,
  newName: string,
): Promise<void> {
  return await invoke("rename_recording", { recordingId, newName });
}

export async function deleteRecording(recordingId: string): Promise<void> {
  return await invoke("delete_recording", { recordingId });
}

// Transcription Commands
export async function startTranscription(): Promise<void> {
  return await invoke("start_transcription");
}

export async function stopTranscription(): Promise<void> {
  return await invoke("stop_transcription");
}

// Summary Commands
export async function generateSummary(
  recordingId: string,
): Promise<TranscriptSummary> {
  return await invoke<TranscriptSummary>("generate_summary", { recordingId });
}

// Export Commands
export async function exportRecording(
  recordingId: string,
  format: "txt" | "json",
): Promise<void> {
  return await invoke("export_recording", { recordingId, format });
}

// Settings Commands
export async function getSettings(): Promise<AppSettings> {
  return await invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return await invoke("save_settings", { settings });
}
