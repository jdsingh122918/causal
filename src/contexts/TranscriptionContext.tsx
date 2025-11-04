import React, { createContext, useContext, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  TranscriptResult,
  EnhancedTranscript,
  TurnBufferItem,
  RecordingStatus,
} from "@/lib/types";

interface TranscriptionState {
  isRecording: boolean;
  status: RecordingStatus;
  transcriptText: string;
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
    turns: new Map(),
    enhancedBuffers: new Map(),
    turnBuffer: [],
    latestTurnOrder: 0,
  });

  // Listen for transcript results
  useEffect(() => {
    let unlistenTranscript: (() => void) | null = null;
    let unlistenEnhanced: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenTranscript = await listen<TranscriptResult>(
        "transcript-result",
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

            // Build full transcript
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
        "enhanced-transcript",
        (event) => {
          const enhanced = event.payload;

          setState((prev) => {
            const newBuffers = new Map(prev.enhancedBuffers);
            newBuffers.set(enhanced.buffer_id, enhanced.enhanced_text);

            return {
              ...prev,
              enhancedBuffers: newBuffers,
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
      await invoke("start_transcription");
      setState((prev) => ({
        ...prev,
        isRecording: true,
        status: "recording",
      }));
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw error;
    }
  };

  const stopRecording = async () => {
    try {
      await invoke("stop_transcription");
      setState((prev) => ({
        ...prev,
        isRecording: false,
        status: "completed",
      }));
    } catch (error) {
      console.error("Failed to stop recording:", error);
      throw error;
    }
  };

  const clearTranscript = () => {
    setState({
      isRecording: false,
      status: "idle",
      transcriptText: "",
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
