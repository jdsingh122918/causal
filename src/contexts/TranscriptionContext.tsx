import React, { createContext, useContext, useState, useEffect } from "react";
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

  // Listen for transcript results
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

      await tauri.startTranscription(
        selectedDeviceId,
        assemblyApiKey,
        claudeApiKey || undefined,
        currentProject?.id || undefined,
        refinementConfig
      );
      setState((prev) => ({
        ...prev,
        isRecording: true,
        status: "recording",
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to start recording:", errorMessage);
      throw error;
    }
  };

  const stopRecording = async () => {
    try {
      await tauri.stopTranscription();
      setState((prev) => ({
        ...prev,
        isRecording: false,
        status: "completed",
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to stop recording:", errorMessage);
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
