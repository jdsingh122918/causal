import { useState, useCallback, useRef } from "react";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import type {
  AnalysisType,
  CombinedIntelligence,
  IntelligenceResult,
  IntelligenceConfig,
} from "@/contexts/IntelligenceContext";

interface UseIntelligenceAnalysisOptions {
  autoInitialize?: boolean;
  onSuccess?: (result: CombinedIntelligence) => void;
  onError?: (error: Error) => void;
  onAnalysisComplete?: (
    analysisType: AnalysisType,
    result: IntelligenceResult,
  ) => void;
}

interface UseIntelligenceAnalysisReturn {
  // Analysis operations
  analyzeText: (
    text: string,
    options?: { bufferId?: number },
  ) => Promise<CombinedIntelligence | null>;

  // Configuration management
  updateApiKey: (apiKey: string) => Promise<void>;
  enableAnalysisTypes: (types: AnalysisType[]) => Promise<void>;
  setModel: (model: string) => Promise<void>;
  updateConfig: (config: Partial<IntelligenceConfig>) => Promise<void>;

  // System management
  initialize: () => Promise<void>;
  testConnection: () => Promise<boolean>;
  reset: () => Promise<void>;

  // State getters
  isReady: boolean;
  isProcessing: boolean;
  hasValidConfig: boolean;
  enabledAnalyses: AnalysisType[];
  lastError: string | null;
  processingStats: {
    totalAnalyses: number;
    successfulAnalyses: number;
    averageProcessingTime: number;
  };

  // Results
  latestResult: CombinedIntelligence | null;
  getAnalysisHistory: () => CombinedIntelligence[];
}

/**
 * Hook for intelligence analysis operations with simplified API
 */
export function useIntelligenceAnalysis(
  options: UseIntelligenceAnalysisOptions = {},
): UseIntelligenceAnalysisReturn {
  const intelligence = useIntelligence();
  const [lastError, setLastError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<CombinedIntelligence | null>(
    null,
  );
  const [processingStats, setProcessingStats] = useState({
    totalAnalyses: 0,
    successfulAnalyses: 0,
    averageProcessingTime: 0,
  });

  const processingTimeTracker = useRef<number[]>([]);
  const resultsHistory = useRef<CombinedIntelligence[]>([]);

  const { onSuccess, onError, onAnalysisComplete } = options;

  // Auto-initialize if requested
  const initialize = useCallback(async () => {
    try {
      setLastError(null);
      if (!intelligence.state.config.api_key) {
        throw new Error("API key is required for initialization");
      }
      await intelligence.initializeSystem();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to initialize intelligence system";
      setLastError(errorMessage);
      if (onError) {
        onError(new Error(errorMessage));
      }
      throw error;
    }
  }, [intelligence, onError]);

  // Enhanced text analysis with error handling and stats tracking
  const analyzeText = useCallback(
    async (
      text: string,
      options: { bufferId?: number } = {},
    ): Promise<CombinedIntelligence | null> => {
      if (!text.trim()) {
        setLastError("Text cannot be empty");
        return null;
      }

      try {
        setLastError(null);
        const startTime = Date.now();

        const result = await intelligence.analyzeText(
          text,
          options.bufferId || Math.floor(Math.random() * 4294967295),
        );

        const processingTime = Date.now() - startTime;
        processingTimeTracker.current.push(processingTime);

        // Keep only last 50 processing times for average calculation
        if (processingTimeTracker.current.length > 50) {
          processingTimeTracker.current =
            processingTimeTracker.current.slice(-50);
        }

        // Update stats
        setProcessingStats((prev) => {
          const totalAnalyses = prev.totalAnalyses + 1;
          const successfulAnalyses = prev.successfulAnalyses + 1;
          const averageProcessingTime =
            processingTimeTracker.current.reduce((a, b) => a + b, 0) /
            processingTimeTracker.current.length;

          return {
            totalAnalyses,
            successfulAnalyses,
            averageProcessingTime: Math.round(averageProcessingTime),
          };
        });

        // Store result
        setLatestResult(result);
        resultsHistory.current.unshift(result);

        // Keep only last 20 results in history
        if (resultsHistory.current.length > 20) {
          resultsHistory.current = resultsHistory.current.slice(0, 20);
        }

        // Trigger callbacks for individual analyses
        Object.entries(result.results).forEach(
          ([analysisType, analysisResult]) => {
            if (onAnalysisComplete) {
              onAnalysisComplete(analysisType as AnalysisType, analysisResult);
            }
          },
        );

        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to analyze text";
        setLastError(errorMessage);

        // Update error stats
        setProcessingStats((prev) => ({
          ...prev,
          totalAnalyses: prev.totalAnalyses + 1,
        }));

        if (onError) {
          onError(new Error(errorMessage));
        }

        return null;
      }
    },
    [intelligence, onSuccess, onError, onAnalysisComplete],
  );

  const updateApiKey = useCallback(
    async (apiKey: string) => {
      try {
        setLastError(null);
        await intelligence.updateConfig({ api_key: apiKey });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update API key";
        setLastError(errorMessage);
        throw error;
      }
    },
    [intelligence],
  );

  const enableAnalysisTypes = useCallback(
    async (types: AnalysisType[]) => {
      try {
        setLastError(null);
        await intelligence.updateConfig({ enabled_analyses: types });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to update analysis types";
        setLastError(errorMessage);
        throw error;
      }
    },
    [intelligence],
  );

  const setModel = useCallback(
    async (model: string) => {
      try {
        setLastError(null);
        await intelligence.updateConfig({ model });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update model";
        setLastError(errorMessage);
        throw error;
      }
    },
    [intelligence],
  );

  const updateConfig = useCallback(
    async (config: Partial<IntelligenceConfig>) => {
      try {
        setLastError(null);
        await intelligence.updateConfig(config);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to update configuration";
        setLastError(errorMessage);
        throw error;
      }
    },
    [intelligence],
  );

  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      setLastError(null);
      const result = await intelligence.testConnectivity();
      return result.status === "success";
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection test failed";
      setLastError(errorMessage);
      return false;
    }
  }, [intelligence]);

  const reset = useCallback(async () => {
    try {
      setLastError(null);
      await intelligence.clearSystem();
      setLatestResult(null);
      resultsHistory.current = [];
      processingTimeTracker.current = [];
      setProcessingStats({
        totalAnalyses: 0,
        successfulAnalyses: 0,
        averageProcessingTime: 0,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to reset system";
      setLastError(errorMessage);
      throw error;
    }
  }, [intelligence]);

  const getAnalysisHistory = useCallback(() => {
    return [...resultsHistory.current];
  }, []);

  // Computed state
  const isReady =
    intelligence.state.isInitialized &&
    intelligence.state.systemStatus?.has_api_key === true;
  const isProcessing = intelligence.state.isProcessing;
  const hasValidConfig = Boolean(
    intelligence.state.config.api_key &&
      intelligence.state.config.enabled_analyses.length > 0,
  );
  const enabledAnalyses = intelligence.state.config.enabled_analyses;

  return {
    analyzeText,
    updateApiKey,
    enableAnalysisTypes,
    setModel,
    updateConfig,
    initialize,
    testConnection,
    reset,
    isReady,
    isProcessing,
    hasValidConfig,
    enabledAnalyses,
    lastError,
    processingStats,
    latestResult,
    getAnalysisHistory,
  };
}

interface UseIntelligenceStatusReturn {
  status: {
    isInitialized: boolean;
    isRunning: boolean;
    agentCount: number;
    model: string;
    hasApiKey: boolean;
    enabledAnalyses: string[];
  };
  refreshStatus: () => Promise<void>;
  isLoading: boolean;
}

/**
 * Hook for monitoring intelligence system status
 */
export function useIntelligenceStatus(): UseIntelligenceStatusReturn {
  const intelligence = useIntelligence();
  const [isLoading, setIsLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      await intelligence.refreshStatus();
    } finally {
      setIsLoading(false);
    }
  }, [intelligence]);

  const status = {
    isInitialized: intelligence.state.isInitialized,
    isRunning: intelligence.state.systemStatus?.is_running ?? false,
    agentCount: intelligence.state.systemStatus?.agent_count ?? 0,
    model:
      intelligence.state.systemStatus?.model ?? intelligence.state.config.model,
    hasApiKey: intelligence.state.systemStatus?.has_api_key ?? false,
    enabledAnalyses: intelligence.state.systemStatus?.enabled_analyses ?? [],
  };

  return {
    status,
    refreshStatus,
    isLoading,
  };
}
