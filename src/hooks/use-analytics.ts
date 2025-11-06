import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjects } from "@/contexts/ProjectsContext";

export interface AnalysisTrend {
  date: string;
  count: number;
  avg_confidence: number | null;
}

export interface AnalysisStats {
  total_count: number;
  by_type: Array<{
    analysis_type: string;
    count: number;
    avg_confidence: number | null;
    avg_processing_time_ms: number | null;
  }>;
}

interface UseAnalyticsOptions {
  days?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseAnalyticsResult {
  // Data
  trends: Record<string, AnalysisTrend[]>;
  stats: AnalysisStats | null;

  // Loading states
  isLoadingTrends: boolean;
  isLoadingStats: boolean;
  isLoading: boolean;

  // Error states
  trendsError: string | null;
  statsError: string | null;
  error: string | null;

  // Actions
  refreshTrends: () => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // Computed values
  totalAnalyses: number;
  analysisTypes: string[];
  mostActiveType: string | null;
  averageConfidence: number | null;
  averageProcessingTime: number | null;
}

const ANALYSIS_TYPES = [
  "Sentiment",
  "Financial",
  "Competitive",
  "Summary",
  "Risk",
];

export function useAnalytics({
  days = 30,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
}: UseAnalyticsOptions = {}): UseAnalyticsResult {
  const { currentProject } = useProjects();

  // State
  const [trends, setTrends] = useState<Record<string, AnalysisTrend[]>>({});
  const [stats, setStats] = useState<AnalysisStats | null>(null);

  // Loading states
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Error states
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Fetch analysis trends for a specific type
  const fetchTrendsForType = useCallback(
    async (analysisType: string) => {
      if (!currentProject?.id) return [];

      try {
        console.log(`[Analytics] Fetching trends for ${analysisType}`);

        const trendData = await invoke<AnalysisTrend[]>("get_analysis_trends", {
          project_id: currentProject.id,
          analysis_type: analysisType,
          days,
        });

        console.log(
          `[Analytics] Found ${trendData.length} trend points for ${analysisType}`,
        );
        return trendData;
      } catch (error) {
        console.error(
          `[Analytics] Failed to fetch trends for ${analysisType}:`,
          error,
        );
        throw error;
      }
    },
    [currentProject?.id, days],
  );

  // Fetch trends for all analysis types
  const refreshTrends = useCallback(async () => {
    if (!currentProject?.id) return;

    setIsLoadingTrends(true);
    setTrendsError(null);

    try {
      console.log(`[Analytics] Fetching trends for all analysis types`);

      const trendPromises = ANALYSIS_TYPES.map(async (type) => ({
        type,
        data: await fetchTrendsForType(type),
      }));

      const trendResults = await Promise.all(trendPromises);

      const trendsMap = trendResults.reduce(
        (acc, { type, data }) => {
          acc[type] = data;
          return acc;
        },
        {} as Record<string, AnalysisTrend[]>,
      );

      setTrends(trendsMap);
      console.log(
        `[Analytics] Successfully loaded trends for ${Object.keys(trendsMap).length} types`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch trends";
      console.error("[Analytics] Error fetching trends:", errorMessage);
      setTrendsError(errorMessage);
    } finally {
      setIsLoadingTrends(false);
    }
  }, [currentProject?.id, fetchTrendsForType]);

  // Fetch analysis statistics
  const refreshStats = useCallback(async () => {
    if (!currentProject?.id) return;

    setIsLoadingStats(true);
    setStatsError(null);

    try {
      console.log("[Analytics] Fetching analysis statistics");

      const statsData = await invoke<AnalysisStats>("get_analysis_stats", {
        project_id: currentProject.id,
      });

      setStats(statsData);
      console.log(
        `[Analytics] Successfully loaded stats: ${statsData.total_count} total analyses`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch statistics";
      console.error("[Analytics] Error fetching statistics:", errorMessage);
      setStatsError(errorMessage);
    } finally {
      setIsLoadingStats(false);
    }
  }, [currentProject?.id]);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([refreshTrends(), refreshStats()]);
  }, [refreshTrends, refreshStats]);

  // Initial data load
  useEffect(() => {
    if (currentProject?.id) {
      refreshAll();
    }
  }, [currentProject?.id, refreshAll]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !currentProject?.id) return;

    const interval = setInterval(() => {
      refreshAll();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, currentProject?.id, refreshAll]);

  // Clear data when project changes
  useEffect(() => {
    setTrends({});
    setStats(null);
    setTrendsError(null);
    setStatsError(null);
  }, [currentProject?.id]);

  // Computed values
  const totalAnalyses = stats?.total_count || 0;
  const analysisTypes = stats?.by_type.map((item) => item.analysis_type) || [];

  const mostActiveType =
    stats?.by_type.reduce((max, current) =>
      current.count > (max?.count || 0) ? current : max,
    )?.analysis_type || null;

  const averageConfidence = stats?.by_type.length
    ? stats.by_type
        .filter((item) => item.avg_confidence !== null)
        .reduce((sum, item) => sum + (item.avg_confidence || 0), 0) /
      stats.by_type.filter((item) => item.avg_confidence !== null).length
    : null;

  const averageProcessingTime = stats?.by_type.length
    ? stats.by_type
        .filter((item) => item.avg_processing_time_ms !== null)
        .reduce((sum, item) => sum + (item.avg_processing_time_ms || 0), 0) /
      stats.by_type.filter((item) => item.avg_processing_time_ms !== null)
        .length
    : null;

  // Combined loading and error states
  const isLoading = isLoadingTrends || isLoadingStats;
  const error = trendsError || statsError;

  return {
    // Data
    trends,
    stats,

    // Loading states
    isLoadingTrends,
    isLoadingStats,
    isLoading,

    // Error states
    trendsError,
    statsError,
    error,

    // Actions
    refreshTrends,
    refreshStats,
    refreshAll,

    // Computed values
    totalAnalyses,
    analysisTypes,
    mostActiveType,
    averageConfidence,
    averageProcessingTime,
  };
}
