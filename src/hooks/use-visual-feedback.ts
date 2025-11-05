import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook for highlighting new items with visual feedback
 *
 * This hook tracks items and highlights newly added ones with visual feedback.
 * Perfect for showing when new projects, recordings, or log entries appear.
 */

interface VisualFeedbackOptions {
  /** Duration to show highlight in milliseconds */
  highlightDuration?: number;
  /** Key function to extract unique identifier from items */
  keyFn?: (item: any) => string;
  /** Whether to highlight items that have changed, not just new ones */
  highlightUpdated?: boolean;
}

export function useNewItemHighlight<T>(
  items: T[],
  options: VisualFeedbackOptions = {},
) {
  const {
    highlightDuration = 3000,
    keyFn = (item: any) => item.id || item.key || String(item),
    highlightUpdated = false,
  } = options;

  const [highlightedItems, setHighlightedItems] = useState<Set<string>>(
    new Set(),
  );
  const [updatedItems, setUpdatedItems] = useState<Set<string>>(new Set());
  const prevItemsRef = useRef<Map<string, T>>(new Map());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const clearHighlight = useCallback((itemKey: string) => {
    setHighlightedItems((prev) => {
      const next = new Set(prev);
      next.delete(itemKey);
      return next;
    });

    setUpdatedItems((prev) => {
      const next = new Set(prev);
      next.delete(itemKey);
      return next;
    });

    // Clear timeout
    const timeout = timeoutsRef.current.get(itemKey);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(itemKey);
    }
  }, []);

  const addHighlight = useCallback(
    (itemKey: string, isUpdate = false) => {
      // Clear any existing timeout for this item
      clearHighlight(itemKey);

      // Add highlight
      if (isUpdate && highlightUpdated) {
        setUpdatedItems((prev) => new Set(prev).add(itemKey));
      } else {
        setHighlightedItems((prev) => new Set(prev).add(itemKey));
      }

      // Set timeout to remove highlight
      const timeout = setTimeout(() => {
        clearHighlight(itemKey);
      }, highlightDuration);

      timeoutsRef.current.set(itemKey, timeout);
    },
    [highlightDuration, highlightUpdated, clearHighlight],
  );

  useEffect(() => {
    const currentItems = new Map(items.map((item) => [keyFn(item), item]));
    const prevItems = prevItemsRef.current;

    // Find new and updated items
    for (const [key, item] of currentItems) {
      const prevItem = prevItems.get(key);

      if (!prevItem) {
        // New item
        addHighlight(key, false);
      } else if (highlightUpdated) {
        // Check if item was updated (simple comparison)
        try {
          if (JSON.stringify(item) !== JSON.stringify(prevItem)) {
            addHighlight(key, true);
          }
        } catch {
          // Fallback if JSON.stringify fails
          if (item !== prevItem) {
            addHighlight(key, true);
          }
        }
      }
    }

    // Update previous items reference
    prevItemsRef.current = currentItems;

    // Cleanup timeouts on unmount
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, [items, keyFn, highlightUpdated, addHighlight]);

  const isHighlighted = useCallback(
    (item: T) => {
      const key = keyFn(item);
      return highlightedItems.has(key);
    },
    [keyFn, highlightedItems],
  );

  const isUpdated = useCallback(
    (item: T) => {
      const key = keyFn(item);
      return updatedItems.has(key);
    },
    [keyFn, updatedItems],
  );

  const manualHighlight = useCallback(
    (item: T, duration?: number) => {
      const key = keyFn(item);
      addHighlight(key, false);

      if (duration && duration !== highlightDuration) {
        // Custom duration
        setTimeout(() => clearHighlight(key), duration);
      }
    },
    [keyFn, addHighlight, clearHighlight, highlightDuration],
  );

  return {
    isHighlighted,
    isUpdated,
    highlightedItems,
    updatedItems,
    manualHighlight,
    clearHighlight: (item: T) => clearHighlight(keyFn(item)),
  };
}

/**
 * Hook for managing flash notifications/toasts
 *
 * This hook provides a simple way to show temporary flash messages
 * for various UI feedback scenarios.
 */

interface FlashMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration: number;
  timestamp: number;
}

interface FlashOptions {
  /** Default duration for flash messages */
  defaultDuration?: number;
  /** Maximum number of flash messages to show */
  maxMessages?: number;
}

export function useFlashMessages(options: FlashOptions = {}) {
  const { defaultDuration = 3000, maxMessages = 5 } = options;
  const [messages, setMessages] = useState<FlashMessage[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));

    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const addMessage = useCallback(
    (
      message: string,
      type: FlashMessage["type"] = "info",
      duration = defaultDuration,
    ) => {
      const id = `flash-${Date.now()}-${Math.random()}`;
      const newMessage: FlashMessage = {
        id,
        message,
        type,
        duration,
        timestamp: Date.now(),
      };

      setMessages((prev) => {
        const updated = [newMessage, ...prev];
        // Limit number of messages
        return updated.slice(0, maxMessages);
      });

      // Auto-remove after duration
      if (duration > 0) {
        const timeout = setTimeout(() => removeMessage(id), duration);
        timeoutsRef.current.set(id, timeout);
      }

      return id;
    },
    [defaultDuration, maxMessages, removeMessage],
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      return addMessage(message, "success", duration);
    },
    [addMessage],
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      return addMessage(message, "error", duration);
    },
    [addMessage],
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      return addMessage(message, "info", duration);
    },
    [addMessage],
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      return addMessage(message, "warning", duration);
    },
    [addMessage],
  );

  const clearAll = useCallback(() => {
    // Clear all timeouts
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();

    setMessages([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  return {
    messages,
    addMessage,
    removeMessage,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    clearAll,
  };
}

/**
 * Hook for pulse/breathing animation on elements
 *
 * This hook provides a pulsing animation state that can be used
 * to draw attention to elements that are being updated.
 */

interface PulseOptions {
  /** Duration of pulse animation in milliseconds */
  duration?: number;
  /** Whether to start pulsing immediately */
  autoStart?: boolean;
}

export function usePulseAnimation(options: PulseOptions = {}) {
  const { duration = 2000, autoStart = false } = options;
  const [isPulsing, setIsPulsing] = useState(autoStart);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startPulse = useCallback(
    (customDuration?: number) => {
      setIsPulsing(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setIsPulsing(false);
        timeoutRef.current = null;
      }, customDuration || duration);
    },
    [duration],
  );

  const stopPulse = useCallback(() => {
    setIsPulsing(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const togglePulse = useCallback(() => {
    if (isPulsing) {
      stopPulse();
    } else {
      startPulse();
    }
  }, [isPulsing, startPulse, stopPulse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isPulsing,
    startPulse,
    stopPulse,
    togglePulse,
  };
}

/**
 * Hook for tracking and displaying loading progress
 *
 * This hook provides progress tracking for operations that have
 * multiple steps or can report progress.
 */

interface ProgressState {
  current: number;
  total: number;
  percentage: number;
  message: string;
  isComplete: boolean;
}

export function useProgressFeedback() {
  const [progress, setProgress] = useState<ProgressState>({
    current: 0,
    total: 0,
    percentage: 0,
    message: "",
    isComplete: false,
  });

  const updateProgress = useCallback(
    (current: number, total: number, message = "") => {
      const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
      const isComplete = current >= total && total > 0;

      setProgress({
        current,
        total,
        percentage,
        message,
        isComplete,
      });
    },
    [],
  );

  const incrementProgress = useCallback((message?: string) => {
    setProgress((prev) => {
      const newCurrent = prev.current + 1;
      const percentage =
        prev.total > 0 ? Math.round((newCurrent / prev.total) * 100) : 0;
      const isComplete = newCurrent >= prev.total && prev.total > 0;

      return {
        ...prev,
        current: newCurrent,
        percentage,
        message: message || prev.message,
        isComplete,
      };
    });
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      message: "",
      isComplete: false,
    });
  }, []);

  const setTotal = useCallback((total: number, message = "") => {
    setProgress((prev) => ({
      ...prev,
      total,
      message,
      percentage: prev.total > 0 ? Math.round((prev.current / total) * 100) : 0,
      isComplete: prev.current >= total && total > 0,
    }));
  }, []);

  return {
    progress,
    updateProgress,
    incrementProgress,
    resetProgress,
    setTotal,
  };
}
