import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  TranscriptResult,
  EnhancedTranscript,
  TurnBufferItem,
  RecordingStatus,
} from "@/lib/types";
import * as tauri from "@/lib/tauri";
import { useSettings } from "./SettingsContext";
import { useProjects } from "./ProjectsContext";
import { useTranscriptionEvents } from "@/hooks/use-realtime-events";

interface TranscriptionState {
  isRecording: boolean;
  status: RecordingStatus;
  transcriptText: string;
  cleanedTranscript: string;
  turns: Map<number, string>;
  enhancedBuffers: Map<number, string>;
  turnBuffer: TurnBufferItem[];
  latestTurnOrder: number;
}

interface TranscriptionContextType {
  state: TranscriptionState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  clearTranscript: () => void;
  copyTranscript: () => void;
}

const TranscriptionContext = createContext<TranscriptionContextType | null>(
  null
);

export function TranscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<TranscriptionState>({
    isRecording: false,
    status: "idle",
    transcriptText: "",
    cleanedTranscript: "",
    turns: new Map(),
    enhancedBuffers: new Map(),
    turnBuffer: [],
    latestTurnOrder: 0,
  });

  const { selectedDeviceId, assemblyApiKey, claudeApiKey, refinementConfig } = useSettings();
  const { currentProject } = useProjects();

  // Real-time event handlers for transcription lifecycle
  const handleTranscriptionStarted = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRecording: true,
      status: "recording",
    }));
  }, []);

  const handleTranscriptionStopped = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRecording: false,
      status: "completed",
    }));
  }, []);

  const handleTranscriptionError = useCallback((error: string) => {
    console.error('Transcription error via real-time event:', error);
    setState((prev) => ({
      ...prev,
      isRecording: false,
      status: "error",
    }));
  }, []);

  const handleSessionCleared = useCallback(() => {
    setState({
      isRecording: false,
      status: "idle",
      transcriptText: "",
      cleanedTranscript: "",
      turns: new Map(),
      enhancedBuffers: new Map(),
      turnBuffer: [],
      latestTurnOrder: 0,
    });
  }, []);

  // Set up real-time event listeners for transcription lifecycle
  useTranscriptionEvents({
    onTranscriptionStarted: handleTranscriptionStarted,
    onTranscriptionStopped: handleTranscriptionStopped,
    onTranscriptionError: handleTranscriptionError,
    onSessionCleared: handleSessionCleared,
  });

  // Listen for transcript results (keeping existing logic but making it more robust)
  useEffect(() => {
    let unlistenTranscript: (() => void) | null = null;
    let unlistenEnhanced: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenTranscript = await listen<TranscriptResult>(
        "transcript",
        (event) => {
          const result = event.payload;

          setState((prev) => {
            const newTurns = new Map(prev.turns);
            const existingText = newTurns.get(result.turn_order) || "";
            newTurns.set(result.turn_order, existingText + result.text + " ");

            // Update latest turn order
            const newLatestTurnOrder = Math.max(
              prev.latestTurnOrder,
              result.turn_order
            );

            // Build full transcript - show raw text immediately for real-time streaming
            const fullTranscript = Array.from(newTurns.entries())
              .sort(([a], [b]) => a - b)
              .map(([, text]) => text)
              .join("");

            return {
              ...prev,
              turns: newTurns,
              transcriptText: fullTranscript,
              latestTurnOrder: newLatestTurnOrder,
            };
          });
        }
      );

      unlistenEnhanced = await listen<EnhancedTranscript>(
        "enhanced_transcript",
        (event) => {
          const enhanced = event.payload;

          setState((prev) => {
            const newBuffers = new Map(prev.enhancedBuffers);
            newBuffers.set(enhanced.buffer_id, enhanced.enhanced_text);

            // Build cleaned transcript from enhanced buffers
            const cleanedTranscript = Array.from(newBuffers.entries())
              .sort(([a], [b]) => a - b)
              .map(([, text]) => text)
              .join(" ");

            return {
              ...prev,
              enhancedBuffers: newBuffers,
              cleanedTranscript,
            };
          });
        }
      );
    };

    setupListeners();

    return () => {
      if (unlistenTranscript) unlistenTranscript();
      if (unlistenEnhanced) unlistenEnhanced();
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!selectedDeviceId) {
        throw new Error("No audio device selected. Please configure in Settings.");
      }

      if (!assemblyApiKey) {
        throw new Error("AssemblyAI API key not configured. Please set it in Settings.");
      }

      // Clear any existing transcript first
      setState({
        isRecording: false,
        status: "idle",
        transcriptText: "",
        cleanedTranscript: "",
        turns: new Map(),
        enhancedBuffers: new Map(),
        turnBuffer: [],
        latestTurnOrder: 0,
      });

      // The backend will emit real-time events to update state
      await tauri.startTranscription(
        selectedDeviceId,
        assemblyApiKey,
        claudeApiKey || undefined,
        currentProject?.id || undefined,
        refinementConfig
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to start recording:", errorMessage);
      // Update state to show error
      setState((prev) => ({
        ...prev,
        isRecording: false,
        status: "error",
      }));
      throw error;
    }
  };

  const stopRecording = async () => {
    try {
      // The backend will emit real-time events to update state
      await tauri.stopTranscription();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to stop recording:", errorMessage);
      // Update state to show error
      setState((prev) => ({
        ...prev,
        isRecording: false,
        status: "error",
      }));
      throw error;
    }
  };

  const clearTranscript = () => {
    setState({
      isRecording: false,
      status: "idle",
      transcriptText: "",
      cleanedTranscript: "",
      turns: new Map(),
      enhancedBuffers: new Map(),
      turnBuffer: [],
      latestTurnOrder: 0,
    });
  };

  const copyTranscript = () => {
    if (state.transcriptText) {
      navigator.clipboard.writeText(state.transcriptText);
    }
  };

  return (
    <TranscriptionContext.Provider
      value={{
        state,
        startRecording,
        stopRecording,
        clearTranscript,
        copyTranscript,
      }}
    >
      {children}
    </TranscriptionContext.Provider>
  );
}

export function useTranscription() {
  const context = useContext(TranscriptionContext);
  if (!context) {
    throw new Error(
      "useTranscription must be used within TranscriptionProvider"
    );
  }
  return context;
}
