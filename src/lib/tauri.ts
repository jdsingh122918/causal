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
  RefinementConfig,
} from "./types";

// Audio Device Commands

/**
 * Retrieves all available audio input and output devices from the system
 * @returns Promise that resolves to an array of AudioDevice objects
 * @throws Error if device enumeration fails
 */
export async function listAudioDevices(): Promise<AudioDevice[]> {
  return await invoke<AudioDevice[]>("list_audio_devices");
}

// Project Commands
export async function listProjects(): Promise<Project[]> {
  return await invoke<Project[]>("list_projects");
}

/**
 * Creates a new project for organizing recordings
 * @param request - Project creation request containing name and description
 * @returns Promise that resolves to the created Project object
 * @throws Error if project creation fails
 */
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

export async function getCurrentProject(): Promise<Project | null> {
  return await invoke<Project | null>("get_current_project");
}

// Recording Commands
export async function listRecordings(projectId: string): Promise<Recording[]> {
  // WORKAROUND: Tauri is transforming snake_case back to camelCase, so send camelCase
  const params = { projectId: projectId };

  try {
    const result = await invoke<Recording[]>("list_recordings", params);
    return result;
  } catch (error) {
    console.error("Failed to list recordings:", error);
    throw error;
  }
}

/**
 * Saves the current transcription session as a recording
 * @param name - User-friendly name for the recording
 * @param summary - Optional summary text for the recording
 * @param keyPoints - Optional array of key points extracted from the transcript
 * @param actionItems - Optional array of action items identified in the transcript
 * @param claudeApiKey - Optional Claude API key for automatic summary generation
 * @param autoGenerateSummary - Whether to automatically generate a summary after saving
 * @returns Promise that resolves to the saved Recording object
 * @throws Error if saving fails or no active transcription session exists
 */
export async function saveRecording(
  name: string,
  summary?: string,
  keyPoints?: string[],
  actionItems?: string[],
  claudeApiKey?: string,
  autoGenerateSummary?: boolean,
): Promise<Recording> {
  return await invoke<Recording>("save_recording", {
    name,
    summary: summary || null,
    keyPoints: keyPoints || [],
    actionItems: actionItems || [],
    claudeApiKey: claudeApiKey || null,
    autoGenerateSummary: autoGenerateSummary || false,
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

/**
 * Starts real-time transcription using the specified audio device and API configuration
 * @param deviceId - Audio input device identifier obtained from listAudioDevices
 * @param apiKey - AssemblyAI API key for transcription service
 * @param claudeApiKey - Optional Claude API key for text enhancement
 * @param projectId - Optional project ID for organizing recordings
 * @param refinementConfig - Configuration for text enhancement options
 * @throws Error if transcription fails to start or API keys are invalid
 */
export async function startTranscription(
  deviceId: string,
  apiKey: string,
  claudeApiKey?: string,
  projectId?: string,
  refinementConfig?: RefinementConfig,
): Promise<void> {
  // WORKAROUND: Tauri is transforming snake_case back to camelCase, so send camelCase
  const params = {
    deviceId: deviceId,
    apiKey: apiKey,
    claudeApiKey: claudeApiKey,
    projectId: projectId,
    refinementConfig: refinementConfig,
  };

  try {
    await invoke("start_transcription", params);
  } catch (error) {
    console.error("Failed to start transcription:", error);
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
