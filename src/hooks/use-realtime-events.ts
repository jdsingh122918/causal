import { useEffect, useCallback, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Hook for managing real-time event listeners from the Tauri backend
 *
 * This hook provides a clean way to listen to real-time events emitted by the backend
 * and automatically manages the cleanup of event listeners.
 */

type EventCallback<T = any> = (payload: T) => void | Promise<void>;

interface UseRealtimeEventsOptions {
  /** Whether to enable event listening */
  enabled?: boolean;
  /** Event listeners mapping event names to callbacks */
  events: Record<string, EventCallback>;
}

/**
 * Hook to listen for real-time events from Tauri backend
 *
 * @param options Configuration object with event listeners
 * @returns Object with utility functions for event management
 */
export function useRealtimeEvents(options: UseRealtimeEventsOptions) {
  const { enabled = true, events } = options;
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  const cleanup = useCallback(() => {
    // Clean up all existing listeners
    unlistenersRef.current.forEach((unlisten) => {
      try {
        unlisten();
      } catch (err) {
        console.error("Error cleaning up event listener:", err);
      }
    });
    unlistenersRef.current = [];
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    const setupListeners = async () => {
      // Clean up any existing listeners first
      cleanup();

      // Set up new listeners
      const newUnlisteners: UnlistenFn[] = [];

      for (const [eventName, callback] of Object.entries(events)) {
        try {
          const unlisten = await listen(eventName, (event) => {
            try {
              callback(event.payload);
            } catch (error) {
              console.error(`Error in event callback for ${eventName}:`, error);
            }
          });
          newUnlisteners.push(unlisten);
        } catch (error) {
          console.error(`Error setting up listener for ${eventName}:`, error);
        }
      }

      unlistenersRef.current = newUnlisteners;
    };

    setupListeners();

    // Cleanup on unmount or dependency change
    return cleanup;
  }, [enabled, events, cleanup]);

  return {
    cleanup,
    isListening: enabled && unlistenersRef.current.length > 0,
  };
}

/**
 * Simplified hook for listening to a single event
 *
 * @param eventName The name of the event to listen for
 * @param callback The callback function to execute when the event is received
 * @param enabled Whether to enable event listening
 */
export function useRealtimeEvent<T = any>(
  eventName: string,
  callback: EventCallback<T>,
  enabled = true,
) {
  return useRealtimeEvents({
    enabled,
    events: {
      [eventName]: callback,
    },
  });
}

/**
 * Hook for listening to multiple project-related events
 *
 * This is a convenience hook for components that need to respond to
 * project creation, updates, and deletions.
 */
export function useProjectEvents(callbacks: {
  onProjectCreated?: EventCallback;
  onProjectUpdated?: EventCallback;
  onProjectDeleted?: EventCallback;
  onCurrentProjectChanged?: EventCallback;
}) {
  const events: Record<string, EventCallback> = {};

  if (callbacks.onProjectCreated) {
    events.project_created = callbacks.onProjectCreated;
  }
  if (callbacks.onProjectUpdated) {
    events.project_updated = callbacks.onProjectUpdated;
  }
  if (callbacks.onProjectDeleted) {
    events.project_deleted = callbacks.onProjectDeleted;
  }
  if (callbacks.onCurrentProjectChanged) {
    events.current_project_changed = callbacks.onCurrentProjectChanged;
  }

  return useRealtimeEvents({ events });
}

/**
 * Hook for listening to recording-related events
 *
 * This is a convenience hook for components that need to respond to
 * recording operations.
 */
export function useRecordingEvents(callbacks: {
  onRecordingCreated?: EventCallback;
  onRecordingUpdated?: EventCallback;
  onRecordingDeleted?: EventCallback;
  onRecordingSaved?: EventCallback;
  onRecordingSummaryGenerated?: EventCallback;
  onRecordingSummaryFailed?: EventCallback;
}) {
  const events: Record<string, EventCallback> = {};

  if (callbacks.onRecordingCreated) {
    events.recording_created = callbacks.onRecordingCreated;
  }
  if (callbacks.onRecordingUpdated) {
    events.recording_updated = callbacks.onRecordingUpdated;
  }
  if (callbacks.onRecordingDeleted) {
    events.recording_deleted = callbacks.onRecordingDeleted;
  }
  if (callbacks.onRecordingSaved) {
    events.recording_saved = callbacks.onRecordingSaved;
  }
  if (callbacks.onRecordingSummaryGenerated) {
    events.recording_summary_generated = callbacks.onRecordingSummaryGenerated;
  }

  return useRealtimeEvents({ events });
}

/**
 * Hook for listening to transcription-related events
 *
 * This is a convenience hook for components that need to respond to
 * transcription state changes and real-time transcript updates.
 */
export function useTranscriptionEvents(callbacks: {
  onTranscriptionStarted?: EventCallback;
  onTranscriptionStopped?: EventCallback;
  onTranscript?: EventCallback;
  onEnhancedTranscript?: EventCallback;
  onTranscriptionError?: EventCallback;
  onSessionCleared?: EventCallback;
}) {
  const events: Record<string, EventCallback> = {};

  if (callbacks.onTranscriptionStarted) {
    events.transcription_started = callbacks.onTranscriptionStarted;
  }
  if (callbacks.onTranscriptionStopped) {
    events.transcription_stopped = callbacks.onTranscriptionStopped;
  }
  if (callbacks.onTranscript) {
    events.transcript = callbacks.onTranscript;
  }
  if (callbacks.onEnhancedTranscript) {
    events.enhanced_transcript = callbacks.onEnhancedTranscript;
  }
  if (callbacks.onTranscriptionError) {
    events.transcription_error = callbacks.onTranscriptionError;
  }
  if (callbacks.onSessionCleared) {
    events.session_cleared = callbacks.onSessionCleared;
  }

  return useRealtimeEvents({ events });
}

/**
 * Hook for listening to logging-related events
 *
 * This is a convenience hook for components like the diagnostics page
 * that need to respond to log updates.
 */
export function useLoggingEvents(callbacks: {
  onLogsRefreshed?: EventCallback;
}) {
  const events: Record<string, EventCallback> = {};

  if (callbacks.onLogsRefreshed) {
    events.logs_refreshed = callbacks.onLogsRefreshed;
  }

  return useRealtimeEvents({ events });
}
