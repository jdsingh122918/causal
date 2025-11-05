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
  return await invoke("set_current_project", { project_id: projectId });
}

export async function deleteProject(projectId: string): Promise<void> {
  return await invoke("delete_project", { id: projectId });
}

export async function getCurrentProject(): Promise<Project> {
  return await invoke<Project>("get_current_project");
}

// Recording Commands
export async function listRecordings(projectId: string): Promise<Recording[]> {
  console.log("🐛 tauri.listRecordings called with projectId:", projectId);
  // WORKAROUND: Tauri is transforming snake_case back to camelCase, so send camelCase
  const params = { projectId: projectId };
  console.log("🐛 About to invoke list_recordings with params:", params);
  console.log("🐛 JSON.stringify(params):", JSON.stringify(params));

  try {
    const result = await invoke<Recording[]>("list_recordings", params);
    console.log("🐛 invoke successful, result:", result);
    return result;
  } catch (error) {
    console.error("🐛 invoke failed with error:", error);
    throw error;
  }
}

export async function saveRecording(
  name: string,
  summary?: string,
  keyPoints?: string[],
  actionItems?: string[],
): Promise<Recording> {
  return await invoke<Recording>("save_recording", {
    name,
    summary: summary || null,
    key_points: keyPoints || [],
    action_items: actionItems || [],
  });
}

export async function renameRecording(
  recordingId: string,
  newName: string,
): Promise<void> {
  return await invoke("update_recording_name", {
    id: recordingId,
    name: newName,
  });
}

export async function deleteRecording(recordingId: string): Promise<void> {
  return await invoke("delete_recording", { id: recordingId });
}

// Transcription Commands
export async function startTranscription(
  deviceId: string,
  apiKey: string,
  claudeApiKey?: string,
  projectId?: string,
  refinementConfig?: any,
): Promise<void> {
  console.log("🐛 tauri.startTranscription called with:", {
    deviceId,
    apiKey,
    claudeApiKey,
    projectId,
    refinementConfig,
  });

  // WORKAROUND: Tauri is transforming snake_case back to camelCase, so send camelCase
  const params = {
    deviceId: deviceId,
    apiKey: apiKey,
    claudeApiKey: claudeApiKey,
    projectId: projectId,
    refinementConfig: refinementConfig,
  };

  console.log("🐛 About to invoke start_transcription with params:", params);
  console.log("🐛 JSON.stringify(params):", JSON.stringify(params));

  try {
    const result = await invoke("start_transcription", params);
    console.log("🐛 invoke successful, result:", result);
  } catch (error) {
    console.error("🐛 invoke failed with error:", error);
    throw error;
  }
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
