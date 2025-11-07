import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjects } from "@/contexts/ProjectsContext";

// Types for MongoDB RAG search results
export interface RecordingSearchResult {
  id: string;
  project_id: string;
  name: string;
  enhanced_transcript: string;
  summary?: string;
  similarity_score: number;
  created_at: string;
}

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  content_type: string;
  similarity_score: number;
}

export interface AnalysisContext {
  query: string;
  relevant_recordings: RecordingSearchResult[];
  knowledge_entries: KnowledgeSearchResult[];
  context_summary: string;
  total_context_tokens: number;
  similarity_threshold: number;
}

export interface MongoSearchFilters {
  project_ids?: string[];
  content_types?: string[];
  similarity_threshold?: number;
  limit?: number;
  include_cross_project?: boolean;
}

export interface UseMongoSearchOptions {
  debounceMs?: number;
  maxRecentSearches?: number;
  autoSearch?: boolean;
  searchMode?: "recordings" | "knowledge" | "context" | "all";
}

export interface UseMongoSearchResult {
  // Query state
  query: string;
  setQuery: (query: string) => void;

  // Results state
  recordingResults: RecordingSearchResult[];
  knowledgeResults: KnowledgeSearchResult[];
  analysisContext: AnalysisContext | null;
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;

  // Actions
  search: (query?: string, filters?: MongoSearchFilters) => Promise<void>;
  searchRecordings: (
    query?: string,
    filters?: MongoSearchFilters,
  ) => Promise<RecordingSearchResult[] | undefined>;
  searchKnowledge: (
    query?: string,
    filters?: MongoSearchFilters,
  ) => Promise<KnowledgeSearchResult[] | undefined>;
  getAnalysisContext: (
    query?: string,
    projectId?: string,
  ) => Promise<AnalysisContext | undefined>;
  clear: () => void;
  retry: () => Promise<void>;

  // Filters
  filters: MongoSearchFilters;
  setFilters: (filters: MongoSearchFilters) => void;

  // Search mode
  searchMode: "recordings" | "knowledge" | "context" | "all";
  setSearchMode: (mode: "recordings" | "knowledge" | "context" | "all") => void;

  // Recent searches
  recentSearches: string[];
  clearRecentSearches: () => void;

  // Suggestions
  suggestions: string[];

  // MongoDB initialization status
  isMongoInitialized: boolean;
  mongoStatus: any;
  initializeMongo: () => Promise<void>;
}

const MONGO_RECENT_SEARCHES_KEY = "causal_mongo_recent_searches";
const MAX_CACHE_SIZE = 30;
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

interface MongoSearchCacheItem {
  recordingResults: RecordingSearchResult[];
  knowledgeResults: KnowledgeSearchResult[];
  analysisContext: AnalysisContext | null;
  timestamp: number;
  filters: MongoSearchFilters;
  searchMode: string;
}

type MongoSearchCache = Map<string, MongoSearchCacheItem>;

export function useMongoSearch({
  debounceMs = 500,
  maxRecentSearches = 10,
  autoSearch = false,
  searchMode: initialSearchMode = "recordings",
}: UseMongoSearchOptions = {}): UseMongoSearchResult {
  const { currentProject } = useProjects();

  // Core state
  const [query, setQueryState] = useState("");
  const [recordingResults, setRecordingResults] = useState<
    RecordingSearchResult[]
  >([]);
  const [knowledgeResults, setKnowledgeResults] = useState<
    KnowledgeSearchResult[]
  >([]);
  const [analysisContext, setAnalysisContext] =
    useState<AnalysisContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<
    "recordings" | "knowledge" | "context" | "all"
  >(initialSearchMode);

  // MongoDB state
  const [isMongoInitialized, setIsMongoInitialized] = useState(false);
  const [mongoStatus, setMongoStatus] = useState(null);

  // Filters state
  const [filters, setFilters] = useState<MongoSearchFilters>({
    project_ids: currentProject?.id ? [currentProject.id] : undefined,
    similarity_threshold: 0.7,
    limit: 10,
    include_cross_project: false,
  });

  // Recent searches and suggestions
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions] = useState<string[]>([
    "financial risks and market analysis",
    "competitive landscape discussion",
    "customer feedback and sentiment",
    "strategic decisions and planning",
    "product development insights",
    "operational challenges mentioned",
    "partnership opportunities",
    "technology trends discussed",
    "team performance feedback",
    "regulatory compliance topics",
  ]);

  // Cache and refs
  const cacheRef = useRef<MongoSearchCache>(new Map());
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastSearchRef = useRef<{
    query: string;
    filters: MongoSearchFilters;
    searchMode: string;
  } | null>(null);

  // Check MongoDB initialization status
  const checkMongoStatus = useCallback(async () => {
    try {
      const initialized = await invoke<boolean>("is_mongo_initialized");
      setIsMongoInitialized(initialized);

      if (initialized) {
        const status = await invoke<any>("get_mongo_status");
        setMongoStatus(status);
      }
    } catch (error) {
      console.warn("MongoDB not available:", error);
      setIsMongoInitialized(false);
    }
  }, []);

  // Initialize MongoDB connection
  const initializeMongo = useCallback(async () => {
    try {
      // This would typically load configuration and initialize
      // For now, we'll just check status
      await checkMongoStatus();
    } catch (error) {
      console.error("Failed to initialize MongoDB:", error);
      setError(
        "MongoDB initialization failed. Please configure MongoDB Atlas in Settings.",
      );
    }
  }, [checkMongoStatus]);

  // Update project filter when current project changes
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      project_ids: currentProject?.id ? [currentProject.id] : undefined,
    }));
  }, [currentProject?.id]);

  // Check MongoDB status on mount
  useEffect(() => {
    checkMongoStatus();
  }, [checkMongoStatus]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MONGO_RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentSearches(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.warn("Failed to load MongoDB recent searches:", error);
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearches = useCallback((searches: string[]) => {
    try {
      localStorage.setItem(MONGO_RECENT_SEARCHES_KEY, JSON.stringify(searches));
    } catch (error) {
      console.warn("Failed to save MongoDB recent searches:", error);
    }
  }, []);

  // Add to recent searches
  const addToRecentSearches = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      setRecentSearches((prev) => {
        const filtered = prev.filter((q) => q !== searchQuery);
        const updated = [searchQuery, ...filtered].slice(0, maxRecentSearches);
        saveRecentSearches(updated);
        return updated;
      });
    },
    [maxRecentSearches, saveRecentSearches],
  );

  // Cache management
  const getCacheKey = useCallback(
    (
      searchQuery: string,
      searchFilters: MongoSearchFilters,
      mode: string,
    ): string => {
      return JSON.stringify({
        query: searchQuery,
        filters: searchFilters,
        mode,
      });
    },
    [],
  );

  const getCachedResult = useCallback(
    (
      searchQuery: string,
      searchFilters: MongoSearchFilters,
      mode: string,
    ): MongoSearchCacheItem | null => {
      const key = getCacheKey(searchQuery, searchFilters, mode);
      const cached = cacheRef.current.get(key);

      if (!cached) return null;

      // Check if cache is expired
      if (Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
        cacheRef.current.delete(key);
        return null;
      }

      return cached;
    },
    [getCacheKey],
  );

  const setCachedResult = useCallback(
    (
      searchQuery: string,
      searchFilters: MongoSearchFilters,
      mode: string,
      results: {
        recordingResults: RecordingSearchResult[];
        knowledgeResults: KnowledgeSearchResult[];
        analysisContext: AnalysisContext | null;
      },
    ) => {
      const key = getCacheKey(searchQuery, searchFilters, mode);

      // Clean up old cache entries if cache is too large
      if (cacheRef.current.size >= MAX_CACHE_SIZE) {
        const oldestKey = Array.from(cacheRef.current.keys())[0];
        cacheRef.current.delete(oldestKey);
      }

      cacheRef.current.set(key, {
        ...results,
        timestamp: Date.now(),
        filters: { ...searchFilters },
        searchMode: mode,
      });
    },
    [getCacheKey],
  );

  // Search recordings using MongoDB semantic search
  const searchRecordings = useCallback(
    async (searchQuery?: string, searchFilters?: MongoSearchFilters) => {
      const finalQuery = searchQuery ?? query;
      const finalFilters = searchFilters ?? filters;

      if (!finalQuery.trim() || !isMongoInitialized) {
        return;
      }

      try {
        console.log(
          `[MongoDB Search] Searching recordings for: "${finalQuery}"`,
        );

        const results = await invoke<RecordingSearchResult[]>(
          "semantic_search_recordings",
          {
            query: finalQuery.trim(),
            project_ids: finalFilters.project_ids,
            limit: finalFilters.limit || 10,
            similarity_threshold: finalFilters.similarity_threshold || 0.7,
          },
        );

        setRecordingResults(results || []);
        console.log(
          `[MongoDB Search] Found ${results?.length || 0} recording results`,
        );
        return results || [];
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Recording search failed";
        console.error("[MongoDB Search] Recording search error:", errorMessage);
        throw new Error(errorMessage);
      }
    },
    [query, filters, isMongoInitialized],
  );

  // Search knowledge base using MongoDB semantic search
  const searchKnowledge = useCallback(
    async (searchQuery?: string, searchFilters?: MongoSearchFilters) => {
      const finalQuery = searchQuery ?? query;
      const finalFilters = searchFilters ?? filters;

      if (!finalQuery.trim() || !isMongoInitialized || !currentProject?.id) {
        return;
      }

      try {
        console.log(
          `[MongoDB Search] Searching knowledge base for: "${finalQuery}"`,
        );

        const results = await invoke<KnowledgeSearchResult[]>(
          "search_knowledge_base",
          {
            query: finalQuery.trim(),
            project_id: currentProject.id,
            content_types: finalFilters.content_types,
            limit: finalFilters.limit || 10,
          },
        );

        setKnowledgeResults(results || []);
        console.log(
          `[MongoDB Search] Found ${results?.length || 0} knowledge results`,
        );
        return results || [];
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Knowledge search failed";
        console.error("[MongoDB Search] Knowledge search error:", errorMessage);
        throw new Error(errorMessage);
      }
    },
    [query, filters, isMongoInitialized, currentProject?.id],
  );

  // Get analysis context using MongoDB RAG
  const getAnalysisContext = useCallback(
    async (searchQuery?: string, projectId?: string) => {
      const finalQuery = searchQuery ?? query;
      const finalProjectId = projectId ?? currentProject?.id;

      if (!finalQuery.trim() || !isMongoInitialized || !finalProjectId) {
        return;
      }

      try {
        console.log(
          `[MongoDB Search] Getting analysis context for: "${finalQuery}"`,
        );

        const context = await invoke<AnalysisContext>("get_analysis_context", {
          query: finalQuery.trim(),
          project_id: finalProjectId,
          context_size: filters.limit || 5,
        });

        setAnalysisContext(context);
        console.log(
          `[MongoDB Search] Retrieved analysis context with ${context?.relevant_recordings?.length || 0} recordings`,
        );
        return context;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Analysis context retrieval failed";
        console.error("[MongoDB Search] Analysis context error:", errorMessage);
        throw new Error(errorMessage);
      }
    },
    [query, filters, isMongoInitialized, currentProject?.id],
  );

  // Main search function that handles all search modes
  const performSearch = useCallback(
    async (
      searchQuery: string,
      searchFilters: MongoSearchFilters,
      mode: string,
    ) => {
      if (!searchQuery.trim()) {
        setRecordingResults([]);
        setKnowledgeResults([]);
        setAnalysisContext(null);
        return;
      }

      if (!isMongoInitialized) {
        throw new Error(
          "MongoDB is not initialized. Please configure MongoDB Atlas in Settings.",
        );
      }

      // Check cache first
      const cachedResults = getCachedResult(searchQuery, searchFilters, mode);
      if (cachedResults) {
        setRecordingResults(cachedResults.recordingResults);
        setKnowledgeResults(cachedResults.knowledgeResults);
        setAnalysisContext(cachedResults.analysisContext);
        setError(null);
        setHasSearched(true);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let recordingResults: RecordingSearchResult[] = [];
        let knowledgeResults: KnowledgeSearchResult[] = [];
        let analysisContext: AnalysisContext | null = null;

        // Perform searches based on mode
        if (mode === "recordings" || mode === "all") {
          recordingResults =
            (await searchRecordings(searchQuery, searchFilters)) || [];
        }

        if (mode === "knowledge" || mode === "all") {
          knowledgeResults =
            (await searchKnowledge(searchQuery, searchFilters)) || [];
        }

        if (mode === "context" || mode === "all") {
          analysisContext =
            (await getAnalysisContext(
              searchQuery,
              searchFilters.project_ids?.[0],
            )) || null;
        }

        setRecordingResults(recordingResults);
        setKnowledgeResults(knowledgeResults);
        setAnalysisContext(analysisContext);
        setHasSearched(true);

        // Cache the results
        setCachedResult(searchQuery, searchFilters, mode, {
          recordingResults,
          knowledgeResults,
          analysisContext,
        });

        // Add to recent searches
        addToRecentSearches(searchQuery);

        console.log(`[MongoDB Search] Search completed for mode: ${mode}`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Search failed";
        console.error("[MongoDB Search] Error:", errorMessage);
        setError(errorMessage);
        setRecordingResults([]);
        setKnowledgeResults([]);
        setAnalysisContext(null);
      } finally {
        setIsLoading(false);
      }
    },
    [
      isMongoInitialized,
      getCachedResult,
      setCachedResult,
      addToRecentSearches,
      searchRecordings,
      searchKnowledge,
      getAnalysisContext,
    ],
  );

  // Debounced search
  const debouncedSearch = useCallback(
    (searchQuery: string, searchFilters: MongoSearchFilters, mode: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery, searchFilters, mode);
      }, debounceMs);
    },
    [performSearch, debounceMs],
  );

  // Public search function
  const search = useCallback(
    async (searchQuery?: string, searchFilters?: MongoSearchFilters) => {
      const finalQuery = searchQuery ?? query;
      const finalFilters = searchFilters ?? filters;

      lastSearchRef.current = {
        query: finalQuery,
        filters: finalFilters,
        searchMode: searchMode,
      };

      if (autoSearch && debounceMs > 0) {
        debouncedSearch(finalQuery, finalFilters, searchMode);
      } else {
        await performSearch(finalQuery, finalFilters, searchMode);
      }
    },
    [
      query,
      filters,
      searchMode,
      autoSearch,
      debounceMs,
      debouncedSearch,
      performSearch,
    ],
  );

  // Auto-search when query or filters change (if enabled)
  useEffect(() => {
    if (autoSearch && query.trim() && isMongoInitialized) {
      debouncedSearch(query, filters, searchMode);
    }
  }, [
    query,
    filters,
    searchMode,
    autoSearch,
    isMongoInitialized,
    debouncedSearch,
  ]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Set query function
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    if (!newQuery.trim()) {
      setRecordingResults([]);
      setKnowledgeResults([]);
      setAnalysisContext(null);
      setError(null);
      setHasSearched(false);
    }
  }, []);

  // Clear function
  const clear = useCallback(() => {
    setQuery("");
    setRecordingResults([]);
    setKnowledgeResults([]);
    setAnalysisContext(null);
    setError(null);
    setHasSearched(false);
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, [setQuery]);

  // Retry function
  const retry = useCallback(async () => {
    if (lastSearchRef.current) {
      await performSearch(
        lastSearchRef.current.query,
        lastSearchRef.current.filters,
        lastSearchRef.current.searchMode,
      );
    }
  }, [performSearch]);

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(MONGO_RECENT_SEARCHES_KEY);
  }, []);

  // Memoized result
  const result = useMemo(
    () => ({
      query,
      setQuery,
      recordingResults,
      knowledgeResults,
      analysisContext,
      isLoading,
      error,
      hasSearched,
      search,
      searchRecordings,
      searchKnowledge,
      getAnalysisContext,
      clear,
      retry,
      filters,
      setFilters,
      searchMode,
      setSearchMode,
      recentSearches,
      clearRecentSearches,
      suggestions,
      isMongoInitialized,
      mongoStatus,
      initializeMongo,
    }),
    [
      query,
      setQuery,
      recordingResults,
      knowledgeResults,
      analysisContext,
      isLoading,
      error,
      hasSearched,
      search,
      searchRecordings,
      searchKnowledge,
      getAnalysisContext,
      clear,
      retry,
      filters,
      setFilters,
      searchMode,
      setSearchMode,
      recentSearches,
      clearRecentSearches,
      suggestions,
      isMongoInitialized,
      mongoStatus,
      initializeMongo,
    ],
  );

  return result;
}
