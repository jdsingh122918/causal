import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  SimilarAnalysis,
  AnalysisType,
  SearchFilters,
} from "@/contexts/IntelligenceContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { logger } from "@/utils/logger";

interface UseHistoricalContextOptions {
  text: string;
  analysisType: AnalysisType;
  projectId?: string;
  enabled?: boolean;
  topK?: number;
  minSimilarity?: number;
}

interface UseHistoricalContextResult {
  similarAnalyses: SimilarAnalysis[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasEmbeddings: boolean;
}

export function useHistoricalContext({
  text,
  analysisType,
  projectId,
  enabled = true,
  topK = 3,
  minSimilarity = 0.7,
}: UseHistoricalContextOptions): UseHistoricalContextResult {
  const { currentProject } = useProjects();
  const [similarAnalyses, setSimilarAnalyses] = useState<SimilarAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEmbeddings, setHasEmbeddings] = useState(false);

  // Use current project if no specific project provided
  const targetProjectId = projectId || currentProject?.id;

  // Check if embeddings are initialized on mount
  useEffect(() => {
    const checkEmbeddingsStatus = async () => {
      const startTime = performance.now();
      try {
        logger.debug("Embeddings", "Checking embeddings initialization status");
        const initialized = await invoke<boolean>("is_embeddings_initialized");
        setHasEmbeddings(initialized);

        // If not initialized, try to initialize
        if (!initialized) {
          logger.info(
            "Embeddings",
            "Embeddings not initialized, attempting initialization...",
          );
          const initStartTime = performance.now();
          await invoke("initialize_embeddings_service");
          const initDuration = performance.now() - initStartTime;
          logger.info(
            "Embeddings",
            `Embeddings service initialized in ${initDuration.toFixed(2)}ms`,
          );

          const recheckInitialized = await invoke<boolean>(
            "is_embeddings_initialized",
          );
          setHasEmbeddings(recheckInitialized);
          logger.debug(
            "Embeddings",
            `Embeddings initialized status: ${recheckInitialized}`,
          );
        } else {
          const checkDuration = performance.now() - startTime;
          logger.debug(
            "Embeddings",
            `Embeddings already initialized (check took ${checkDuration.toFixed(2)}ms)`,
          );
        }
      } catch (err) {
        const duration = performance.now() - startTime;
        logger.error(
          "Embeddings",
          `Failed to check/initialize embeddings after ${duration.toFixed(2)}ms`,
          err,
        );
        setHasEmbeddings(false);
      }
    };

    checkEmbeddingsStatus();
  }, []);

  const fetchSimilarAnalyses = useCallback(async () => {
    // Skip if disabled, no text, no project, or embeddings not available
    if (!enabled || !text.trim() || !targetProjectId || !hasEmbeddings) {
      setSimilarAnalyses([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const startTime = performance.now();
    const trimmedText = text.trim();

    try {
      logger.info(
        "Embeddings",
        `Fetching historical context for ${analysisType} analysis (project: ${targetProjectId}, text_length: ${trimmedText.length}, top_k: ${topK}, min_similarity: ${minSimilarity})`,
      );

      const vectorizeStartTime = performance.now();
      const similarResults = await invoke<SimilarAnalysis[]>(
        "get_analysis_context",
        {
          text: trimmedText,
          projectId: targetProjectId,
          analysisType: analysisType,
          topK,
          minSimilarity,
        },
      );
      const vectorizeDuration = performance.now() - vectorizeStartTime;

      setSimilarAnalyses(similarResults || []);

      if (similarResults && similarResults.length > 0) {
        const totalDuration = performance.now() - startTime;
        logger.info(
          "Embeddings",
          `Found ${similarResults.length} similar analyses in ${totalDuration.toFixed(2)}ms (vectorization: ${vectorizeDuration.toFixed(2)}ms)`,
          {
            analysis_type: analysisType,
            result_count: similarResults.length,
            avg_similarity:
              similarResults.reduce((sum, r) => sum + r.similarity_score, 0) /
              similarResults.length,
          },
        );
      } else {
        const totalDuration = performance.now() - startTime;
        logger.debug(
          "Embeddings",
          `No similar analyses found in ${totalDuration.toFixed(2)}ms`,
        );
      }
    } catch (err) {
      const duration = performance.now() - startTime;
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to fetch historical context";
      logger.error(
        "Embeddings",
        `Error fetching historical context after ${duration.toFixed(2)}ms: ${errorMessage}`,
        err,
      );
      setError(errorMessage);
      setSimilarAnalyses([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    enabled,
    text,
    targetProjectId,
    analysisType,
    topK,
    minSimilarity,
    hasEmbeddings,
  ]);

  // Refresh function for manual triggers
  const refresh = useCallback(async () => {
    await fetchSimilarAnalyses();
  }, [fetchSimilarAnalyses]);

  // Auto-fetch when dependencies change
  useEffect(() => {
    fetchSimilarAnalyses();
  }, [fetchSimilarAnalyses]);

  // Memoize the result to prevent unnecessary re-renders
  const result = useMemo(
    () => ({
      similarAnalyses,
      isLoading,
      error,
      refresh,
      hasEmbeddings,
    }),
    [similarAnalyses, isLoading, error, refresh, hasEmbeddings],
  );

  return result;
}

// Alternative hook for semantic search across all analyses
export function useSemanticSearch() {
  const { currentProject } = useProjects();
  const [results, setResults] = useState<SimilarAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (query: string, filters?: Partial<SearchFilters>) => {
      if (!query.trim() || !currentProject?.id) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      const startTime = performance.now();
      const trimmedQuery = query.trim();

      try {
        const searchFilters: SearchFilters = {
          project_id: currentProject.id,
          top_k: 10,
          min_similarity: 0.5,
          ...filters,
        };

        logger.info(
          "Embeddings",
          `Semantic search initiated - query: "${trimmedQuery}" (length: ${trimmedQuery.length})`,
          { filters: searchFilters },
        );

        const vectorizeStartTime = performance.now();
        const searchResults = await invoke<SimilarAnalysis[]>(
          "search_analyses_semantic",
          {
            query: trimmedQuery,
            filters: searchFilters,
          },
        );
        const vectorizeDuration = performance.now() - vectorizeStartTime;

        setResults(searchResults || []);

        if (searchResults && searchResults.length > 0) {
          const totalDuration = performance.now() - startTime;
          const avgSimilarity =
            searchResults.reduce((sum, r) => sum + r.similarity_score, 0) /
            searchResults.length;
          logger.info(
            "Embeddings",
            `Semantic search completed in ${totalDuration.toFixed(2)}ms - found ${searchResults.length} results (vectorization: ${vectorizeDuration.toFixed(2)}ms, avg_similarity: ${avgSimilarity.toFixed(3)})`,
          );
        } else {
          const totalDuration = performance.now() - startTime;
          logger.debug(
            "Embeddings",
            `Semantic search completed in ${totalDuration.toFixed(2)}ms - no results found`,
          );
        }
      } catch (err) {
        const duration = performance.now() - startTime;
        const errorMessage =
          err instanceof Error ? err.message : "Search failed";
        logger.error(
          "Embeddings",
          `Semantic search failed after ${duration.toFixed(2)}ms: ${errorMessage}`,
          err,
        );
        setError(errorMessage);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [currentProject?.id],
  );

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    isLoading,
    error,
    search,
    clear,
  };
}
