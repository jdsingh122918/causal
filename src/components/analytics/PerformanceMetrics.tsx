import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Target } from "lucide-react";

interface AnalysisTypeStat {
  analysis_type: string;
  count: number;
  avg_confidence: number | null;
  avg_processing_time_ms: number | null;
}

interface PerformanceMetricsProps {
  stats: AnalysisTypeStat[];
  isLoading?: boolean;
}

const ANALYSIS_COLORS = {
  Sentiment: "#ec4899",
  Financial: "#10b981",
  Competitive: "#3b82f6",
  Summary: "#8b5cf6",
  Risk: "#ef4444",
};

export function PerformanceMetrics({ stats, isLoading = false }: PerformanceMetricsProps) {
  const metricsData = useMemo(() => {
    if (isLoading || !stats || stats.length === 0) {
      return [];
    }

    return stats
      .filter(item => item.count > 0)
      .map(item => ({
        name: item.analysis_type,
        count: item.count,
        confidence: item.avg_confidence ? Math.round(item.avg_confidence * 100) : 0,
        processingTime: item.avg_processing_time_ms || 0,
        color: ANALYSIS_COLORS[item.analysis_type as keyof typeof ANALYSIS_COLORS] || "#6b7280",
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats, isLoading]);

  const overallStats = useMemo(() => {
    if (metricsData.length === 0) {
      return {
        totalAnalyses: 0,
        avgConfidence: 0,
        avgProcessingTime: 0,
        maxProcessingTime: 0,
        minProcessingTime: 0,
      };
    }

    const totalAnalyses = metricsData.reduce((sum, item) => sum + item.count, 0);
    const validConfidences = metricsData.filter(item => item.confidence > 0);
    const validProcessingTimes = metricsData.filter(item => item.processingTime > 0);

    return {
      totalAnalyses,
      avgConfidence: validConfidences.length > 0
        ? validConfidences.reduce((sum, item) => sum + item.confidence, 0) / validConfidences.length
        : 0,
      avgProcessingTime: validProcessingTimes.length > 0
        ? validProcessingTimes.reduce((sum, item) => sum + item.processingTime, 0) / validProcessingTimes.length
        : 0,
      maxProcessingTime: validProcessingTimes.length > 0
        ? Math.max(...validProcessingTimes.map(item => item.processingTime))
        : 0,
      minProcessingTime: validProcessingTimes.length > 0
        ? Math.min(...validProcessingTimes.map(item => item.processingTime))
        : 0,
    };
  }, [metricsData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    const data = payload[0].payload;

    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="font-medium mb-2">{label}</p>
        <p className="text-sm">
          Count: <span className="font-medium">{data.count.toLocaleString()}</span>
        </p>
        <p className="text-sm">
          Confidence: <span className="font-medium">{data.confidence}%</span>
        </p>
        <p className="text-sm">
          Avg Time: <span className="font-medium">{data.processingTime}ms</span>
        </p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Summary Cards Loading */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 bg-muted rounded-lg animate-pulse">
              <div className="h-4 bg-muted-foreground/20 rounded w-20 mb-2"></div>
              <div className="h-6 bg-muted-foreground/20 rounded w-16"></div>
            </div>
          ))}
        </div>

        {/* Chart Loading */}
        <div className="h-[200px] bg-muted rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (metricsData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-center">
        <div>
          <div className="text-4xl mb-2">⚡</div>
          <p className="text-sm text-muted-foreground">No performance data available</p>
          <p className="text-xs text-muted-foreground mt-1">Start analyzing to see performance metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
                <p className="text-xl font-bold">{overallStats.avgConfidence.toFixed(1)}%</p>
              </div>
              <Target className="h-6 w-6 text-green-500" />
            </div>
            <Progress value={overallStats.avgConfidence} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Processing</p>
                <p className="text-xl font-bold">{Math.round(overallStats.avgProcessingTime)}ms</p>
              </div>
              <Clock className="h-6 w-6 text-blue-500" />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Min: {Math.round(overallStats.minProcessingTime)}ms</span>
              <span>Max: {Math.round(overallStats.maxProcessingTime)}ms</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Performance</p>
                <div className="flex items-center gap-2 mt-1">
                  {overallStats.avgConfidence >= 80 && overallStats.avgProcessingTime <= 2000 && (
                    <Badge variant="default" className="bg-green-500">
                      Excellent
                    </Badge>
                  )}
                  {overallStats.avgConfidence >= 70 && overallStats.avgProcessingTime <= 3000 &&
                   !(overallStats.avgConfidence >= 80 && overallStats.avgProcessingTime <= 2000) && (
                    <Badge variant="secondary">
                      Good
                    </Badge>
                  )}
                  {(overallStats.avgConfidence < 70 || overallStats.avgProcessingTime > 3000) && (
                    <Badge variant="outline">
                      Fair
                    </Badge>
                  )}
                </div>
              </div>
              <TrendingUp className="h-6 w-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={metricsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis
              yAxisId="left"
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              className="text-xs"
              stroke="currentColor"
            />
            <Tooltip content={<CustomTooltip />} />

            <Bar
              yAxisId="left"
              dataKey="confidence"
              name="Confidence %"
              fill="#10b981"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Metrics Table */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Detailed Metrics by Type</h4>
        <div className="space-y-2">
          {metricsData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium">{item.name}</span>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground">Count</p>
                  <p className="font-medium">{item.count.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Confidence</p>
                  <p className="font-medium">{item.confidence}%</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">{item.processingTime}ms</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}