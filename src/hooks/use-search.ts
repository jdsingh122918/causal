import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  SimilarAnalysis,
  SearchFilters,
} from "@/contexts/IntelligenceContext";
import { useProjects } from "@/contexts/ProjectsContext";

interface UseSearchOptions {
  debounceMs?: number;
  maxRecentSearches?: number;
  autoSearch?: boolean;
}

interface UseSearchResult {
  // Query state
  query: string;
  setQuery: (query: string) => void;

  // Results state
  results: SimilarAnalysis[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;

  // Actions
  search: (query?: string, filters?: SearchFilters) => Promise<void>;
  clear: () => void;
  retry: () => Promise<void>;

  // Filters
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;

  // Recent searches
  recentSearches: string[];
  clearRecentSearches: () => void;

  // Suggestions
  suggestions: string[];

  // Cache
  clearCache: () => void;
}

const RECENT_SEARCHES_KEY = "causal_recent_searches";
const MAX_CACHE_SIZE = 50;
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface SearchCacheItem {
  results: SimilarAnalysis[];
  timestamp: number;
  filters: SearchFilters;
}

type SearchCache = Map<string, SearchCacheItem>;

export function useSearch({
  debounceMs = 300,
  maxRecentSearches = 10,
  autoSearch = false,
}: UseSearchOptions = {}): UseSearchResult {
  const { currentProject } = useProjects();

  // Core state
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<SimilarAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters state
  const [filters, setFilters] = useState<SearchFilters>({
    project_id: currentProject?.id,
    top_k: 10,
    min_similarity: 0.5,
  });

  // Recent searches and suggestions
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions] = useState<string[]>([
    "financial risks and opportunities",
    "competitive advantages mentioned",
    "action items and next steps",
    "sentiment changes over time",
    "key decisions made",
  ]);

  // Cache and refs
  const cacheRef = useRef<SearchCache>(new Map());
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastSearchRef = useRef<{
    query: string;
    filters: SearchFilters;
  } | null>(null);

  // Update project filter when current project changes
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      project_id: currentProject?.id,
    }));
  }, [currentProject?.id]);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentSearches(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.warn("Failed to load recent searches:", error);
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearches = useCallback((searches: string[]) => {
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    } catch (error) {
      console.warn("Failed to save recent searches:", error);
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
    (searchQuery: string, searchFilters: SearchFilters): string => {
      return JSON.stringify({ query: searchQuery, filters: searchFilters });
    },
    [],
  );

  const getCachedResult = useCallback(
    (
      searchQuery: string,
      searchFilters: SearchFilters,
    ): SimilarAnalysis[] | null => {
      const key = getCacheKey(searchQuery, searchFilters);
      const cached = cacheRef.current.get(key);

      if (!cached) return null;

      // Check if cache is expired
      if (Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
        cacheRef.current.delete(key);
        return null;
      }

      return cached.results;
    },
    [getCacheKey],
  );

  const setCachedResult = useCallback(
    (
      searchQuery: string,
      searchFilters: SearchFilters,
      searchResults: SimilarAnalysis[],
    ) => {
      const key = getCacheKey(searchQuery, searchFilters);

      // Clean up old cache entries if cache is too large
      if (cacheRef.current.size >= MAX_CACHE_SIZE) {
        const oldestKey = Array.from(cacheRef.current.keys())[0];
        cacheRef.current.delete(oldestKey);
      }

      cacheRef.current.set(key, {
        results: searchResults,
        timestamp: Date.now(),
        filters: { ...searchFilters },
      });
    },
    [getCacheKey],
  );

  // Main search function
  const performSearch = useCallback(
    async (searchQuery: string, searchFilters: SearchFilters) => {
      if (!searchQuery.trim() || !currentProject?.id) {
        setResults([]);
        return;
      }

      // Check cache first
      const cachedResults = getCachedResult(searchQuery, searchFilters);
      if (cachedResults) {
        setResults(cachedResults);
        setError(null);
        setHasSearched(true);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log(`[Search] Searching for: "${searchQuery}"`);

        const searchResults = await invoke<SimilarAnalysis[]>(
          "search_analyses_semantic",
          {
            query: searchQuery.trim(),
            filters: {
              ...searchFilters,
              project_id: currentProject.id,
            },
          },
        );

        setResults(searchResults || []);
        setHasSearched(true);

        // Cache the results
        setCachedResult(searchQuery, searchFilters, searchResults || []);

        // Add to recent searches
        addToRecentSearches(searchQuery);

        console.log(`[Search] Found ${searchResults?.length || 0} results`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Search failed";
        console.error("[Search] Error:", errorMessage);
        setError(errorMessage);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [currentProject?.id, getCachedResult, setCachedResult, addToRecentSearches],
  );

  // Debounced search
  const debouncedSearch = useCallback(
    (searchQuery: string, searchFilters: SearchFilters) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery, searchFilters);
      }, debounceMs);
    },
    [performSearch, debounceMs],
  );

  // Public search function
  const search = useCallback(
    async (searchQuery?: string, searchFilters?: SearchFilters) => {
      const finalQuery = searchQuery ?? query;
      const finalFilters = searchFilters ?? filters;

      lastSearchRef.current = { query: finalQuery, filters: finalFilters };

      if (autoSearch && debounceMs > 0) {
        debouncedSearch(finalQuery, finalFilters);
      } else {
        await performSearch(finalQuery, finalFilters);
      }
    },
    [query, filters, autoSearch, debounceMs, debouncedSearch, performSearch],
  );

  // Auto-search when query or filters change (if enabled)
  useEffect(() => {
    if (autoSearch && query.trim()) {
      debouncedSearch(query, filters);
    }
  }, [query, filters, autoSearch, debouncedSearch]);

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
      setResults([]);
      setError(null);
      setHasSearched(false);
    }
  }, []);

  // Clear function
  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
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
      );
    }
  }, [performSearch]);

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  // Memoized result
  const result = useMemo(
    () => ({
      query,
      setQuery,
      results,
      isLoading,
      error,
      hasSearched,
      search,
      clear,
      retry,
      filters,
      setFilters,
      recentSearches,
      clearRecentSearches,
      suggestions,
      clearCache,
    }),
    [
      query,
      setQuery,
      results,
      isLoading,
      error,
      hasSearched,
      search,
      clear,
      retry,
      filters,
      setFilters,
      recentSearches,
      clearRecentSearches,
      suggestions,
      clearCache,
    ],
  );

  return result;
}
