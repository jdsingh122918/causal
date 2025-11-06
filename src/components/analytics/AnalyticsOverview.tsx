import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  BarChart3,
  Activity,
  Clock,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";
import { TrendChart } from "./TrendChart";
import { DistributionChart } from "./DistributionChart";
import { PerformanceMetrics } from "./PerformanceMetrics";

interface AnalyticsOverviewProps {
  className?: string;
}

export function AnalyticsOverview({ className }: AnalyticsOverviewProps) {
  const analytics = useAnalytics({
    days: 30,
    autoRefresh: true,
    refreshInterval: 60000, // 1 minute
  });

  if (analytics.error) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Analytics Error</h3>
          <p className="text-muted-foreground mb-4">{analytics.error}</p>
          <Button onClick={analytics.refreshAll} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Analyses</p>
                <p className="text-2xl font-bold">
                  {analytics.isLoadingStats ? "..." : analytics.totalAnalyses.toLocaleString()}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Most Active</p>
                <p className="text-lg font-semibold">
                  {analytics.isLoadingStats ? "..." : (analytics.mostActiveType || "None")}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
                <p className="text-lg font-semibold">
                  {analytics.isLoadingStats
                    ? "..."
                    : analytics.averageConfidence
                      ? `${(analytics.averageConfidence * 100).toFixed(1)}%`
                      : "N/A"
                  }
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Time</p>
                <p className="text-lg font-semibold">
                  {analytics.isLoadingStats
                    ? "..."
                    : analytics.averageProcessingTime
                      ? `${Math.round(analytics.averageProcessingTime)}ms`
                      : "N/A"
                  }
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Trends Chart */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Analysis Trends (30 Days)</CardTitle>
              {analytics.isLoadingTrends && (
                <Badge variant="secondary" className="animate-pulse">
                  Loading...
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <TrendChart
              trends={analytics.trends}
              isLoading={analytics.isLoadingTrends}
            />
          </CardContent>
        </Card>

        {/* Distribution Chart */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Analysis Type Distribution</CardTitle>
              {analytics.isLoadingStats && (
                <Badge variant="secondary" className="animate-pulse">
                  Loading...
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <DistributionChart
              stats={analytics.stats?.by_type || []}
              isLoading={analytics.isLoadingStats}
            />
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceMetrics
            stats={analytics.stats?.by_type || []}
            isLoading={analytics.isLoadingStats}
          />
        </CardContent>
      </Card>

      {/* Refresh Controls */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Auto-refreshing every minute
        </div>
        <Button
          onClick={analytics.refreshAll}
          variant="outline"
          size="sm"
          disabled={analytics.isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${analytics.isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}