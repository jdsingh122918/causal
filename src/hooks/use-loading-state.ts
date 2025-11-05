import { useState, useCallback, useRef } from "react";

/**
 * Hook for managing loading states with advanced error handling and operation tracking
 *
 * This hook provides a comprehensive solution for managing async operations with loading states,
 * error handling, and operation tracking. It's perfect for UI components that need to show
 * loading indicators and handle errors gracefully.
 */

interface LoadingStateOptions {
  /** Initial loading state */
  initialLoading?: boolean;
  /** Whether to reset error when starting a new operation */
  resetErrorOnStart?: boolean;
  /** Maximum number of retries for failed operations */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

interface AsyncOperationOptions {
  /** Whether to show loading state for this operation */
  showLoading?: boolean;
  /** Custom error message prefix */
  errorPrefix?: string;
  /** Whether to retry on failure */
  allowRetry?: boolean;
}

export function useLoadingState(options: LoadingStateOptions = {}) {
  const {
    initialLoading = false,
    resetErrorOnStart = true,
    maxRetries = 0,
    retryDelay = 1000,
  } = options;

  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);
  const [operationCount, setOperationCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetState = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setOperationCount(0);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const execute = useCallback(
    async <T>(
      operation: (signal?: AbortSignal) => Promise<T>,
      operationOptions: AsyncOperationOptions = {},
    ): Promise<T> => {
      const {
        showLoading = true,
        errorPrefix = "",
        allowRetry = maxRetries > 0,
      } = operationOptions;

      let retryCount = 0;
      const maxRetryAttempts = allowRetry ? maxRetries : 0;

      const attemptOperation = async (): Promise<T> => {
        // Increment operation count
        setOperationCount((prev) => prev + 1);

        if (showLoading) {
          setIsLoading(true);
        }

        if (resetErrorOnStart) {
          setError(null);
        }

        // Create new abort controller for this operation
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const result = await operation(controller.signal);

          // Success - reset states
          if (showLoading) {
            setIsLoading(false);
          }
          setError(null);

          return result;
        } catch (err) {
          // Handle abort
          if (controller.signal.aborted) {
            if (showLoading) {
              setIsLoading(false);
            }
            throw new Error("Operation cancelled");
          }

          const errorMessage = err instanceof Error ? err.message : String(err);
          const fullErrorMessage = errorPrefix
            ? `${errorPrefix}: ${errorMessage}`
            : errorMessage;

          // Check if we should retry
          if (retryCount < maxRetryAttempts) {
            retryCount++;
            console.warn(
              `Operation failed, retrying (${retryCount}/${maxRetryAttempts}):`,
              errorMessage,
            );

            // Wait before retry
            if (retryDelay > 0) {
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }

            // Check if still not aborted before retry
            if (!controller.signal.aborted) {
              return attemptOperation();
            }
          }

          // Final failure
          if (showLoading) {
            setIsLoading(false);
          }
          setError(fullErrorMessage);

          throw err;
        }
      };

      return attemptOperation();
    },
    [resetErrorOnStart, maxRetries, retryDelay],
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    error,
    operationCount,
    execute,
    cancel,
    resetState,
    clearError,
    hasError: error !== null,
    canRetry: maxRetries > 0,
  };
}

/**
 * Hook for managing multiple concurrent loading operations
 *
 * This hook is useful when you need to track multiple async operations
 * simultaneously and show a combined loading state.
 */
export function useMultipleLoadingStates() {
  const [loadingOperations, setLoadingOperations] = useState<Set<string>>(
    new Set(),
  );
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  const startOperation = useCallback((operationId: string) => {
    setLoadingOperations((prev) => new Set(prev).add(operationId));
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(operationId);
      return next;
    });
  }, []);

  const finishOperation = useCallback((operationId: string, error?: string) => {
    setLoadingOperations((prev) => {
      const next = new Set(prev);
      next.delete(operationId);
      return next;
    });

    if (error) {
      setErrors((prev) => new Map(prev).set(operationId, error));
    }
  }, []);

  const executeOperation = useCallback(
    async <T>(operationId: string, operation: () => Promise<T>): Promise<T> => {
      startOperation(operationId);
      try {
        const result = await operation();
        finishOperation(operationId);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        finishOperation(operationId, errorMessage);
        throw error;
      }
    },
    [startOperation, finishOperation],
  );

  const clearError = useCallback((operationId: string) => {
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(operationId);
      return next;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors(new Map());
  }, []);

  const isLoading = loadingOperations.size > 0;
  const hasErrors = errors.size > 0;
  const errorMessages = Array.from(errors.values());

  return {
    isLoading,
    hasErrors,
    errors: Object.fromEntries(errors),
    errorMessages,
    loadingOperations: Array.from(loadingOperations),
    executeOperation,
    startOperation,
    finishOperation,
    clearError,
    clearAllErrors,
  };
}

/**
 * Hook for optimistic updates with loading states
 *
 * This hook combines loading state management with optimistic updates,
 * providing a smooth user experience during async operations.
 */
export function useOptimisticOperation<T>() {
  const [optimisticState, setOptimisticState] = useState<T | null>(null);
  const [isOptimistic, setIsOptimistic] = useState(false);
  const { isLoading, error, execute, clearError } = useLoadingState();

  const executeOptimistic = useCallback(
    async <R>(
      optimisticValue: T,
      operation: () => Promise<R>,
      onSuccess?: (result: R) => void,
      onError?: (error: Error) => void,
    ): Promise<R> => {
      // Set optimistic state
      setOptimisticState(optimisticValue);
      setIsOptimistic(true);

      try {
        const result = await execute(operation);

        // Clear optimistic state on success
        setOptimisticState(null);
        setIsOptimistic(false);

        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (err) {
        // Clear optimistic state on error
        setOptimisticState(null);
        setIsOptimistic(false);

        if (onError && err instanceof Error) {
          onError(err);
        }

        throw err;
      }
    },
    [execute],
  );

  const clearOptimistic = useCallback(() => {
    setOptimisticState(null);
    setIsOptimistic(false);
  }, []);

  return {
    optimisticState,
    isOptimistic,
    isLoading,
    error,
    executeOptimistic,
    clearOptimistic,
    clearError,
  };
}

/**
 * Simple hook for managing boolean loading state
 *
 * This is a lightweight alternative when you just need basic loading state
 * without advanced features like retries or operation tracking.
 */
export function useSimpleLoading(initialState = false) {
  const [isLoading, setIsLoading] = useState(initialState);

  const withLoading = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      setIsLoading(true);
      try {
        const result = await operation();
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    isLoading,
    setIsLoading,
    withLoading,
  };
}
