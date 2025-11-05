import React, { createContext, useContext, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Recording, TranscriptSummary } from "@/lib/types";
import { useProjects } from "./ProjectsContext";
import * as tauri from "@/lib/tauri";

interface RecordingsContextType {
  recordings: Recording[];
  currentRecording: Recording | null;
  lastSummary: TranscriptSummary | null;
  loading: boolean;
  loadRecordings: () => Promise<void>;
  saveRecording: (name: string, transcript: string) => Promise<void>;
  renameRecording: (recordingId: string, newName: string) => Promise<void>;
  deleteRecording: (recordingId: string) => Promise<void>;
  generateSummary: (recordingId: string) => Promise<void>;
  exportRecording: (recordingId: string, format: "txt" | "json") => Promise<void>;
  setCurrentRecording: (recording: Recording | null) => void;
}

const RecordingsContext = createContext<RecordingsContextType | null>(null);

export function RecordingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentRecording, setCurrentRecording] = useState<Recording | null>(
    null
  );
  const [lastSummary, setLastSummary] = useState<TranscriptSummary | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const { currentProject } = useProjects();

  // Load recordings when current project changes
  useEffect(() => {
    if (currentProject) {
      loadRecordings();
    } else {
      setRecordings([]);
      setCurrentRecording(null);
    }
  }, [currentProject]);

  const loadRecordings = async () => {
    if (!currentProject) return;

    try {
      setLoading(true);
      const recordingsList = await tauri.listRecordings(currentProject.id);
      setRecordings(recordingsList);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to load recordings:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const saveRecording = async (name: string, _transcript: string) => {
    if (!currentProject) {
      throw new Error("No project selected");
    }

    try {
      // The backend save_recording command saves from the current session
      // WORKAROUND: Tauri transforms snake_case to camelCase, so send camelCase directly
      const recording = await invoke<Recording>("save_recording", {
        name,
        summary: null,
        keyPoints: [],
        actionItems: [],
      });
      setRecordings((prev) => [recording, ...prev]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to save recording:", errorMessage);
      throw error;
    }
  };

  const renameRecording = async (recordingId: string, newName: string) => {
    try {
      await tauri.renameRecording(recordingId, newName);
      setRecordings((prev) =>
        prev.map((r) => (r.id === recordingId ? { ...r, name: newName } : r))
      );
      if (currentRecording?.id === recordingId) {
        setCurrentRecording((prev) =>
          prev ? { ...prev, name: newName } : null
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to rename recording:", errorMessage);
      throw error;
    }
  };

  const deleteRecording = async (recordingId: string) => {
    try {
      await tauri.deleteRecording(recordingId);
      setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
      if (currentRecording?.id === recordingId) {
        setCurrentRecording(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to delete recording:", errorMessage);
      throw error;
    }
  };

  const generateSummary = async (recordingId: string) => {
    try {
      // Get claude API key from localStorage
      const settingsStr = localStorage.getItem("causal_settings");
      const settings = settingsStr ? JSON.parse(settingsStr) : {};
      const claudeApiKey = settings.claude_api_key || "";

      if (!claudeApiKey) {
        throw new Error("Claude API key not configured. Please set it in Settings.");
      }

      // WORKAROUND: Tauri transforms snake_case to camelCase, so send camelCase directly
      const recording = await invoke<Recording>("generate_recording_summary", {
        recordingId: recordingId,
        claudeApiKey: claudeApiKey,
      });

      // Update recordings list
      setRecordings((prev) =>
        prev.map((r) => (r.id === recordingId ? recording : r))
      );

      // Create summary object for lastSummary
      const summary: TranscriptSummary = {
        summary: recording.summary || "",
        key_points: recording.key_points,
        action_items: recording.action_items,
        metadata: {
          duration_seconds: recording.metadata.duration_seconds,
          chunk_count: recording.metadata.chunk_count,
          word_count: recording.metadata.word_count,
          timestamp: new Date(recording.created_at * 1000).toISOString(),
        },
      };
      setLastSummary(summary);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to generate summary:", errorMessage);
      throw error;
    }
  };

  const exportRecording = async (
    recordingId: string,
    format: "txt" | "json"
  ) => {
    try {
      // Use Tauri save dialog to get output path
      const { save } = await import("@tauri-apps/plugin-dialog");
      const extension = format === "txt" ? "txt" : "json";
      const outputPath = await save({
        defaultPath: `recording.${extension}`,
        filters: [
          {
            name: format.toUpperCase(),
            extensions: [extension],
          },
        ],
      });

      if (outputPath) {
        // WORKAROUND: Tauri transforms snake_case to camelCase, so send camelCase directly
        await invoke("export_recording", {
          recordingId: recordingId,
          outputPath: outputPath,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to export recording:", errorMessage);
      throw error;
    }
  };

  return (
    <RecordingsContext.Provider
      value={{
        recordings,
        currentRecording,
        lastSummary,
        loading,
        loadRecordings,
        saveRecording,
        renameRecording,
        deleteRecording,
        generateSummary,
        exportRecording,
        setCurrentRecording,
      }}
    >
      {children}
    </RecordingsContext.Provider>
  );
}

export function useRecordings() {
  const context = useContext(RecordingsContext);
  if (!context) {
    throw new Error("useRecordings must be used within RecordingsProvider");
  }
  return context;
}
