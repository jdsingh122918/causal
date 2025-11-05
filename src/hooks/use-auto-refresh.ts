import { useEffect, useCallback, useRef, useState } from "react";

/**
 * Hook for auto-refresh functionality with smart intervals and backoff
 *
 * This hook provides intelligent auto-refresh capabilities with features like:
 * - Exponential backoff on errors
 * - Pause/resume functionality
 * - Dynamic interval adjustment
 * - Error handling and retry logic
 */

interface AutoRefreshOptions {
  /** Base refresh interval in milliseconds */
  interval?: number;
  /** Whether auto-refresh is enabled by default */
  enabled?: boolean;
  /** Maximum interval during exponential backoff */
  maxInterval?: number;
  /** Backoff multiplier on errors */
  backoffMultiplier?: number;
  /** Whether to pause when page is not visible */
  pauseOnHidden?: boolean;
  /** Whether to refresh immediately when becoming visible */
  refreshOnVisible?: boolean;
}

export function useAutoRefresh(
  refreshFunction: () => Promise<void> | void,
  options: AutoRefreshOptions = {},
) {
  const {
    interval = 5000,
    enabled = false,
    maxInterval = 60000,
    backoffMultiplier = 1.5,
    pauseOnHidden = true,
    refreshOnVisible = true,
  } = options;

  const [isEnabled, setIsEnabled] = useState(enabled);
  const [currentInterval, setCurrentInterval] = useState(interval);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshFunctionRef = useRef(refreshFunction);

  // Update the refresh function ref when it changes
  useEffect(() => {
    refreshFunctionRef.current = refreshFunction;
  }, [refreshFunction]);

  const clearCurrentInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const executeRefresh = useCallback(async () => {
    try {
      await refreshFunctionRef.current();

      // Success - reset interval and increment success count
      setCurrentInterval(interval);
      setErrorCount(0);
      setRefreshCount((prev) => prev + 1);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Auto-refresh error:", error);

      // Error - increase interval with exponential backoff
      setErrorCount((prev) => prev + 1);
      setCurrentInterval((prev) =>
        Math.min(prev * backoffMultiplier, maxInterval),
      );
    }
  }, [interval, backoffMultiplier, maxInterval]);

  const startAutoRefresh = useCallback(() => {
    clearCurrentInterval();

    if (!isEnabled) return;

    // Execute refresh immediately
    executeRefresh();

    // Set up interval
    intervalRef.current = setInterval(executeRefresh, currentInterval);
  }, [isEnabled, currentInterval, executeRefresh, clearCurrentInterval]);

  const stopAutoRefresh = useCallback(() => {
    clearCurrentInterval();
  }, [clearCurrentInterval]);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  const enable = useCallback(() => {
    setIsEnabled(true);
  }, []);

  const disable = useCallback(() => {
    setIsEnabled(false);
  }, []);

  const forceRefresh = useCallback(async () => {
    await executeRefresh();
  }, [executeRefresh]);

  const resetInterval = useCallback(() => {
    setCurrentInterval(interval);
    setErrorCount(0);
  }, [interval]);

  // Handle page visibility changes
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAutoRefresh();
      } else {
        if (isEnabled) {
          if (refreshOnVisible) {
            // Refresh immediately when becoming visible
            forceRefresh();
          }
          startAutoRefresh();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [
    pauseOnHidden,
    refreshOnVisible,
    isEnabled,
    startAutoRefresh,
    stopAutoRefresh,
    forceRefresh,
  ]);

  // Main effect for managing auto-refresh
  useEffect(() => {
    if (isEnabled && !document.hidden) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }

    return stopAutoRefresh;
  }, [isEnabled, startAutoRefresh, stopAutoRefresh]);

  // Update interval when currentInterval changes
  useEffect(() => {
    if (isEnabled && !document.hidden) {
      startAutoRefresh();
    }
  }, [currentInterval, startAutoRefresh, isEnabled]);

  return {
    isEnabled,
    currentInterval,
    lastRefresh,
    refreshCount,
    errorCount,
    isActive: intervalRef.current !== null,
    toggle,
    enable,
    disable,
    forceRefresh,
    resetInterval,
  };
}

/**
 * Hook for smart auto-refresh with adaptive intervals
 *
 * This version automatically adjusts refresh intervals based on activity
 * and data freshness, providing an optimized user experience.
 */
interface SmartAutoRefreshOptions extends AutoRefreshOptions {
  /** Minimum interval in milliseconds */
  minInterval?: number;
  /** Factor to increase interval when no changes detected */
  slowdownFactor?: number;
  /** Factor to decrease interval when changes detected */
  speedupFactor?: number;
  /** Number of unchanged refreshes before slowing down */
  unchangedThreshold?: number;
}

export function useSmartAutoRefresh(
  refreshFunction: () => Promise<boolean>, // Returns true if data changed
  options: SmartAutoRefreshOptions = {},
) {
  const {
    interval = 5000,
    minInterval = 1000,
    maxInterval = 30000,
    slowdownFactor = 1.5,
    speedupFactor = 0.8,
    unchangedThreshold = 3,
    ...baseOptions
  } = options;

  const [unchangedCount, setUnchangedCount] = useState(0);
  const [dynamicInterval, setDynamicInterval] = useState(interval);

  const smartRefreshFunction = useCallback(async () => {
    const hasChanges = await refreshFunction();

    if (hasChanges) {
      // Data changed - reset unchanged count and potentially speed up
      setUnchangedCount(0);
      setDynamicInterval((prev) => Math.max(prev * speedupFactor, minInterval));
    } else {
      // No changes - increment unchanged count
      setUnchangedCount((prev) => {
        const newCount = prev + 1;

        // Slow down after threshold
        if (newCount >= unchangedThreshold) {
          setDynamicInterval((current) =>
            Math.min(current * slowdownFactor, maxInterval),
          );
        }

        return newCount;
      });
    }
  }, [
    refreshFunction,
    speedupFactor,
    slowdownFactor,
    minInterval,
    maxInterval,
    unchangedThreshold,
  ]);

  const autoRefresh = useAutoRefresh(smartRefreshFunction, {
    ...baseOptions,
    interval: dynamicInterval,
  });

  return {
    ...autoRefresh,
    unchangedCount,
    dynamicInterval,
  };
}

/**
 * Hook for conditional auto-refresh
 *
 * Only refreshes when certain conditions are met, useful for
 * performance optimization and reducing unnecessary API calls.
 */
interface ConditionalAutoRefreshOptions extends AutoRefreshOptions {
  /** Function that returns true if refresh should occur */
  shouldRefresh?: () => boolean;
  /** Refresh when specific dependencies change */
  refreshDependencies?: any[];
}

export function useConditionalAutoRefresh(
  refreshFunction: () => Promise<void> | void,
  options: ConditionalAutoRefreshOptions = {},
) {
  const {
    shouldRefresh = () => true,
    refreshDependencies = [],
    ...baseOptions
  } = options;

  const conditionalRefreshFunction = useCallback(async () => {
    if (shouldRefresh()) {
      await refreshFunction();
    }
  }, [refreshFunction, shouldRefresh]);

  const autoRefresh = useAutoRefresh(conditionalRefreshFunction, baseOptions);

  // Force refresh when dependencies change
  useEffect(() => {
    if (autoRefresh.isEnabled && shouldRefresh()) {
      autoRefresh.forceRefresh();
    }
  }, [
    ...refreshDependencies,
    autoRefresh.isEnabled,
    autoRefresh.forceRefresh,
    shouldRefresh,
  ]);

  return autoRefresh;
}
