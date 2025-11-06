import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AnalysisTrend } from "@/hooks/use-analytics";

interface TrendChartProps {
  trends: Record<string, AnalysisTrend[]>;
  isLoading?: boolean;
}

const ANALYSIS_COLORS = {
  Sentiment: "#ec4899", // Pink
  Financial: "#10b981", // Green
  Competitive: "#3b82f6", // Blue
  Summary: "#8b5cf6", // Purple
  Risk: "#ef4444", // Red
};

export function TrendChart({ trends, isLoading = false }: TrendChartProps) {
  const chartData = useMemo(() => {
    if (isLoading || !trends || Object.keys(trends).length === 0) {
      return [];
    }

    // Get all unique dates from all trend data
    const allDates = new Set<string>();
    Object.values(trends).forEach(trendArray => {
      trendArray.forEach(item => allDates.add(item.date));
    });

    const sortedDates = Array.from(allDates).sort();

    // Create combined data structure
    return sortedDates.map(date => {
      const dataPoint: any = { date };

      Object.entries(trends).forEach(([analysisType, trendArray]) => {
        const item = trendArray.find(t => t.date === date);
        dataPoint[analysisType] = item?.count || 0;
      });

      return dataPoint;
    });
  }, [trends, isLoading]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    const total = payload.reduce((sum: number, item: any) => sum + (item.value || 0), 0);

    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="font-medium mb-2">{formatDate(label)}</p>
        {payload
          .filter((item: any) => item.value > 0)
          .sort((a: any, b: any) => b.value - a.value)
          .map((item: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: item.color }}>
              {item.dataKey}: {item.value} analyses
            </p>
          ))}
        {total > 0 && (
          <div className="border-t border-border mt-2 pt-2">
            <p className="text-sm font-medium">Total: {total} analyses</p>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-32 mb-4"></div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 bg-muted rounded w-24"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-center">
        <div>
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm text-muted-foreground">No trend data available</p>
          <p className="text-xs text-muted-foreground mt-1">Start analyzing to see trends</p>
        </div>
      </div>
    );
  }

  const activeAnalysisTypes = Object.keys(trends).filter(type =>
    trends[type] && trends[type].some(item => item.count > 0)
  );

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            className="text-xs"
            stroke="currentColor"
          />
          <YAxis
            className="text-xs"
            stroke="currentColor"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
          />

          {activeAnalysisTypes.map(analysisType => (
            <Line
              key={analysisType}
              type="monotone"
              dataKey={analysisType}
              stroke={ANALYSIS_COLORS[analysisType as keyof typeof ANALYSIS_COLORS] || "#6b7280"}
              strokeWidth={2}
              dot={{ fill: ANALYSIS_COLORS[analysisType as keyof typeof ANALYSIS_COLORS] || "#6b7280", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}