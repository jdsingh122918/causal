import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  SimilarAnalysis,
  AnalysisType,
  SearchFilters,
} from "@/contexts/IntelligenceContext";
import { useProjects } from "@/contexts/ProjectsContext";

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
      try {
        const initialized = await invoke<boolean>("is_embeddings_initialized");
        setHasEmbeddings(initialized);

        // If not initialized, try to initialize
        if (!initialized) {
          console.log(
            "[Historical Context] Embeddings not initialized, attempting initialization...",
          );
          await invoke("initialize_embeddings_service");
          const recheckInitialized = await invoke<boolean>(
            "is_embeddings_initialized",
          );
          setHasEmbeddings(recheckInitialized);
        }
      } catch (err) {
        console.warn(
          "[Historical Context] Failed to check/initialize embeddings:",
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

    try {
      console.log(
        `[Historical Context] Fetching context for ${analysisType} analysis in project ${targetProjectId}`,
      );

      const similarResults = await invoke<SimilarAnalysis[]>(
        "get_analysis_context",
        {
          text: text.trim(),
          projectId: targetProjectId,
          analysisType: analysisType,
          topK,
          minSimilarity,
        },
      );

      setSimilarAnalyses(similarResults || []);

      if (similarResults && similarResults.length > 0) {
        console.log(
          `[Historical Context] Found ${similarResults.length} similar analyses`,
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to fetch historical context";
      console.error(`[Historical Context] Error:`, errorMessage);
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

      try {
        const searchFilters: SearchFilters = {
          project_id: currentProject.id,
          top_k: 10,
          min_similarity: 0.5,
          ...filters,
        };

        console.log(`[Semantic Search] Searching for: "${query}"`);

        const searchResults = await invoke<SimilarAnalysis[]>(
          "search_analyses_semantic",
          {
            query: query.trim(),
            filters: searchFilters,
          },
        );

        setResults(searchResults || []);

        if (searchResults && searchResults.length > 0) {
          console.log(
            `[Semantic Search] Found ${searchResults.length} results`,
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Search failed";
        console.error(`[Semantic Search] Error:`, errorMessage);
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
