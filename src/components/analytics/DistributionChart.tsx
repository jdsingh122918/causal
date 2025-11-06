import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface AnalysisTypeStat {
  analysis_type: string;
  count: number;
  avg_confidence: number | null;
  avg_processing_time_ms: number | null;
}

interface DistributionChartProps {
  stats: AnalysisTypeStat[];
  isLoading?: boolean;
}

const ANALYSIS_COLORS = {
  Sentiment: "#ec4899", // Pink
  Financial: "#10b981", // Green
  Competitive: "#3b82f6", // Blue
  Summary: "#8b5cf6", // Purple
  Risk: "#ef4444", // Red
  default: "#6b7280", // Gray
};

export function DistributionChart({ stats, isLoading = false }: DistributionChartProps) {
  const chartData = useMemo(() => {
    if (isLoading || !stats || stats.length === 0) {
      return [];
    }

    return stats
      .filter(item => item.count > 0)
      .map(item => ({
        name: item.analysis_type,
        value: item.count,
        percentage: 0, // Will be calculated below
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats, isLoading]);

  // Calculate percentages
  const totalCount = chartData.reduce((sum, item) => sum + item.value, 0);
  const dataWithPercentages = chartData.map(item => ({
    ...item,
    percentage: totalCount > 0 ? (item.value / totalCount) * 100 : 0,
  }));

  const getColor = (analysisType: string): string => {
    return ANALYSIS_COLORS[analysisType as keyof typeof ANALYSIS_COLORS] || ANALYSIS_COLORS.default;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    const data = payload[0].payload;

    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="font-medium mb-2">{data.name}</p>
        <p className="text-sm">
          Count: <span className="font-medium">{data.value.toLocaleString()}</span>
        </p>
        <p className="text-sm">
          Share: <span className="font-medium">{data.percentage.toFixed(1)}%</span>
        </p>
      </div>
    );
  };

  const CustomLegend = ({ payload }: any) => {
    if (!payload || payload.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col gap-1 text-xs mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="flex-1">{entry.value}</span>
            <span className="font-medium">
              {entry.payload.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-32 h-32 bg-muted rounded-full mx-auto mb-4"></div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-3 bg-muted rounded w-20 mx-auto"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (dataWithPercentages.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-center">
        <div>
          <div className="text-4xl mb-2">🥧</div>
          <p className="text-sm text-muted-foreground">No distribution data available</p>
          <p className="text-xs text-muted-foreground mt-1">Start analyzing to see distribution</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={dataWithPercentages}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {dataWithPercentages.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getColor(entry.name)}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}