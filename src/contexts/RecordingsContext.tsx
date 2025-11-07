import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Recording, TranscriptSummary, Project } from "@/lib/types";
import { useProjects } from "./ProjectsContext";
import { useSettings } from "./SettingsContext";
import { useRecordingEvents } from "@/hooks/use-realtime-events";
import * as tauri from "@/lib/tauri";
import type { RecordingAnalysisSnapshot } from "@/hooks/use-recording-intelligence";
import { logger } from "@/utils/logger";

interface RecordingsContextType {
  recordings: Recording[];
  currentRecording: Recording | null;
  lastSummary: TranscriptSummary | null;
  loading: boolean;
  optimisticOperations: Map<string, Recording>;
  loadRecordings: () => Promise<void>;
  saveRecording: (name: string, transcript: string) => Promise<void>;
  renameRecording: (recordingId: string, newName: string) => Promise<void>;
  deleteRecording: (recordingId: string) => Promise<void>;
  generateSummary: (recordingId: string) => Promise<void>;
  exportRecording: (recordingId: string, format: "txt" | "json") => Promise<void>;
  setCurrentRecording: (recording: Recording | null) => void;
  refreshRecordings: () => Promise<void>;
  attachIntelligenceAnalysis?: (recordingId: string, snapshot: RecordingAnalysisSnapshot) => Promise<void>;
  getIntelligenceAnalysis?: (recordingId: string) => Promise<RecordingAnalysisSnapshot | null>;
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
  const [optimisticOperations, setOptimisticOperations] = useState<Map<string, Recording>>(new Map());
  const { currentProject, refreshCurrentProject, projects } = useProjects();
  const { claudeApiKey } = useSettings();

  // Real-time event handlers
  const handleRecordingCreated = useCallback((recording: Recording) => {
    setRecordings((prev) => {
      // Check if recording already exists to avoid duplicates
      const exists = prev.some(r => r.id === recording.id);
      if (exists) return prev;
      return [recording, ...prev];
    });

    // Remove any optimistic operation
    setOptimisticOperations(prev => {
      const next = new Map(prev);
      // Find and remove any optimistic recording with matching name
      for (const [key, optimisticRecording] of prev) {
        if (optimisticRecording.name === recording.name) {
          next.delete(key);
          break;
        }
      }
      return next;
    });
  }, []);

  const handleRecordingUpdated = useCallback((recording: Recording) => {
    setRecordings((prev) => prev.map(r => r.id === recording.id ? recording : r));

    // Update current recording if it's the one that was updated
    setCurrentRecording(current => current?.id === recording.id ? recording : current);
  }, []);

  const handleRecordingDeleted = useCallback((payload: { id: string }) => {
    setRecordings((prev) => prev.filter(r => r.id !== payload.id));

    // Clear current recording if it's the one that was deleted
    setCurrentRecording(current => current?.id === payload.id ? null : current);
  }, []);

  const handleRecordingSaved = useCallback((recording: Recording) => {
    // Add the recording to the list
    setRecordings((prev) => {
      // Check if recording already exists to avoid duplicates
      const exists = prev.some(r => r.id === recording.id);
      if (exists) return prev;
      return [recording, ...prev];
    });

    // Remove any optimistic operation that matches this recording
    setOptimisticOperations(prev => {
      const next = new Map(prev);
      // Find and remove optimistic recording with matching name AND project
      for (const [key, optimisticRecording] of prev) {
        if (optimisticRecording.name === recording.name &&
            optimisticRecording.project_id === recording.project_id) {
          next.delete(key);
          break;
        }
      }
      return next;
    });
  }, []);

  const handleRecordingSummaryGenerated = useCallback((recording: Recording) => {
    setRecordings((prev) => prev.map(r => r.id === recording.id ? recording : r));

    // Update current recording if it's the one with the new summary
    setCurrentRecording(current => current?.id === recording.id ? recording : current);

    // Update lastSummary if this is the current recording
    if (currentRecording?.id === recording.id) {
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
    }
  }, [currentRecording]);

  const handleRecordingSummaryFailed = useCallback((payload: { recording_id: string; error: string }) => {
    logger.warn('Recordings', 'Recording summary generation failed:', payload);
    // Could show a toast notification here or update UI to indicate failure
    // For now, just log the event - the manual generation button will still be available
  }, []);

  // Set up real-time event listeners
  useRecordingEvents({
    onRecordingCreated: handleRecordingCreated,
    onRecordingUpdated: handleRecordingUpdated,
    onRecordingDeleted: handleRecordingDeleted,
    onRecordingSaved: handleRecordingSaved,
    onRecordingSummaryGenerated: handleRecordingSummaryGenerated,
    onRecordingSummaryFailed: handleRecordingSummaryFailed,
  });

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
      logger.error("Recordings", "Failed to load recordings:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshRecordings = useCallback(async () => {
    if (!currentProject) return;

    // Non-loading refresh for real-time updates
    try {
      const recordingsList = await tauri.listRecordings(currentProject.id);
      setRecordings(recordingsList);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Recordings", "Failed to refresh recordings:", errorMessage);
    }
  }, [currentProject]);

  const saveRecording = async (name: string, _transcript: string) => {
    // Determine which project to use
    let projectToUse = currentProject;

    if (!projectToUse) {
      logger.warn("Recordings", "No current project in context, attempting to restore...");

      // Try multiple restoration methods
      try {
        // Method 1: Refresh current project from backend
        await refreshCurrentProject();
        const refreshedProject = await invoke<Project | null>("get_current_project");

        if (refreshedProject) {
          logger.info("Recordings", `Successfully restored project: ${refreshedProject.name}`);
          projectToUse = refreshedProject;
        } else {
          // Method 2: Try to get from localStorage and set as current
          const lastSelectedProjectId = localStorage.getItem("causal_last_selected_project");
          if (lastSelectedProjectId) {
            logger.info("Recordings", `Attempting to restore from localStorage: ${lastSelectedProjectId}`);

            // Get all projects and find the last selected one
            const allProjects = await tauri.listProjects();
            const lastProject = allProjects.find(p => p.id === lastSelectedProjectId);

            if (lastProject) {
              logger.info("Recordings", `Found project in localStorage, setting as current: ${lastProject.name}`);
              await tauri.selectProject(lastProject.id);
              projectToUse = lastProject;
            } else {
              // Method 3: Auto-select first available project
              if (allProjects.length > 0) {
                logger.info("Recordings", `Auto-selecting first available project: ${allProjects[0].name}`);
                await tauri.selectProject(allProjects[0].id);
                projectToUse = allProjects[0];
              } else {
                throw new Error("No projects available. Please create a project first.");
              }
            }
          } else if (projects.length > 0) {
            // Method 4: Auto-select first project from context
            logger.info("Recordings", `Auto-selecting first project from context: ${projects[0].name}`);
            await tauri.selectProject(projects[0].id);
            projectToUse = projects[0];
          } else {
            throw new Error("No projects available. Please create a project first.");
          }
        }
      } catch (refreshError) {
        logger.error("Recordings", "Failed to restore project:", refreshError);
        throw new Error("Unable to determine project for saving recording. Please select a project and try again.");
      }
    }

    // Final safety check
    if (!projectToUse) {
      throw new Error("Failed to determine project for saving recording. Please select a project and try again.");
    }

    logger.info("Recordings", `Saving recording to project: ${projectToUse.name}`);

    // Generate optimistic ID
    const optimisticId = `temp-${Date.now()}`;
    const optimisticRecording: Recording = {
      id: optimisticId,
      project_id: projectToUse.id,
      name,
      raw_transcript: _transcript,
      enhanced_transcript: "",
      summary: null,
      key_points: [],
      action_items: [],
      created_at: Date.now(),
      status: "Recording",
      metadata: {
        duration_seconds: 0,
        chunk_count: 0,
        word_count: _transcript.split(' ').length,
        turn_count: 1,
        average_confidence: 0.95,
      },
    };

    // Add optimistic update
    setOptimisticOperations(prev => new Map(prev).set(optimisticId, optimisticRecording));

    try {
      // Use the updated tauri wrapper with automatic summary generation
      const shouldAutoGenerate = claudeApiKey && claudeApiKey.trim().length > 0;

      await tauri.saveRecording(
        name,
        undefined, // summary
        undefined, // keyPoints
        undefined, // actionItems
        shouldAutoGenerate ? claudeApiKey : undefined, // claudeApiKey
        shouldAutoGenerate || false // autoGenerateSummary
      );

      // Add a fallback refresh in case the real-time event doesn't work
      setTimeout(() => {
        refreshRecordings();
      }, 1000);
    } catch (error) {
      // Remove optimistic update on error
      setOptimisticOperations(prev => {
        const next = new Map(prev);
        next.delete(optimisticId);
        return next;
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Recordings", "Failed to save recording:", errorMessage);
      throw error;
    }
  };

  const renameRecording = async (recordingId: string, newName: string) => {
    // Check if this is an optimistic recording (temporary ID)
    if (recordingId.startsWith('temp-')) {
      throw new Error("Cannot rename recording that is still being saved");
    }

    // Check if recording exists in real recordings (not optimistic)
    const realRecording = recordings.find(r => r.id === recordingId && !r.id.startsWith('temp-'));
    if (!realRecording) {
      throw new Error("Recording not found or still being processed");
    }

    // Store original data for potential rollback
    const originalRecordings = recordings;
    const originalCurrentRecording = currentRecording;

    // Optimistically update recording name
    setRecordings((prev) =>
      prev.map((r) => (r.id === recordingId ? { ...r, name: newName } : r))
    );
    if (currentRecording?.id === recordingId) {
      setCurrentRecording((prev) =>
        prev ? { ...prev, name: newName } : null
      );
    }

    try {
      // Real update will be confirmed via real-time event
      await tauri.renameRecording(recordingId, newName);
    } catch (error) {
      // Rollback optimistic changes on error
      setRecordings(originalRecordings);
      setCurrentRecording(originalCurrentRecording);

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Recordings", "Failed to rename recording:", errorMessage);
      throw error;
    }
  };

  const deleteRecording = async (recordingId: string) => {
    // Store original state for potential rollback
    const originalRecordings = recordings;
    const originalCurrentRecording = currentRecording;

    // Optimistically remove recording
    setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
    if (currentRecording?.id === recordingId) {
      setCurrentRecording(null);
    }

    try {
      // Real deletion will be confirmed via real-time event
      await tauri.deleteRecording(recordingId);
    } catch (error) {
      // Rollback optimistic changes on error
      setRecordings(originalRecordings);
      setCurrentRecording(originalCurrentRecording);

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Recordings", "Failed to delete recording:", errorMessage);
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
      // Real summary will be updated via real-time event
      await invoke<Recording>("generate_recording_summary", {
        recordingId: recordingId,
        claudeApiKey: claudeApiKey,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Recordings", "Failed to generate summary:", errorMessage);
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
      logger.error("Recordings", "Failed to export recording:", errorMessage);
      throw error;
    }
  };

  // Intelligence analysis persistence methods (localStorage for now, will be moved to backend in Phase 4)
  const attachIntelligenceAnalysis = async (
    recordingId: string,
    snapshot: RecordingAnalysisSnapshot
  ) => {
    try {
      // For now, store in localStorage with recording ID as key
      const storageKey = `intelligence_analysis_${recordingId}`;
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
      logger.debug("Recordings", `Intelligence analysis attached to recording ${recordingId}`);
    } catch (error) {
      logger.error("Recordings", "Failed to store intelligence analysis:", error);
      throw error;
    }
  };

  const getIntelligenceAnalysis = async (
    recordingId: string
  ): Promise<RecordingAnalysisSnapshot | null> => {
    try {
      const storageKey = `intelligence_analysis_${recordingId}`;
      const storedData = localStorage.getItem(storageKey);

      if (storedData) {
        return JSON.parse(storedData) as RecordingAnalysisSnapshot;
      }

      return null;
    } catch (error) {
      logger.error("Recordings", "Failed to retrieve intelligence analysis:", error);
      return null;
    }
  };

  // Combine real recordings with optimistic operations for display
  const displayRecordings = [
    ...recordings,
    ...Array.from(optimisticOperations.values())
  ];

  return (
    <RecordingsContext.Provider
      value={{
        recordings: displayRecordings,
        currentRecording,
        lastSummary,
        loading,
        optimisticOperations,
        loadRecordings,
        saveRecording,
        renameRecording,
        deleteRecording,
        generateSummary,
        exportRecording,
        setCurrentRecording,
        refreshRecordings,
        attachIntelligenceAnalysis,
        getIntelligenceAnalysis,
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
