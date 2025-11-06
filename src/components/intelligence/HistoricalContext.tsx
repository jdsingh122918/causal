import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, TrendingUp, ArrowRight } from "lucide-react";
import type { SimilarAnalysis } from "@/contexts/IntelligenceContext";

interface HistoricalContextProps {
  similarAnalyses: SimilarAnalysis[];
  isLoading?: boolean;
  onAnalysisClick?: (analysis: SimilarAnalysis) => void;
}

export function HistoricalContext({
  similarAnalyses,
  isLoading = false,
  onAnalysisClick
}: HistoricalContextProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="animate-pulse">
          <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-2 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (similarAnalyses.length === 0) {
    return (
      <div className="text-center py-3">
        <p className="text-xs text-muted-foreground">
          No similar past analyses found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">
          Similar Past Insights ({similarAnalyses.length})
        </span>
      </div>

      {similarAnalyses.map((analysis, index) => (
        <HistoricalAnalysisCard
          key={analysis.id}
          analysis={analysis}
          rank={index + 1}
          onClick={() => onAnalysisClick?.(analysis)}
        />
      ))}
    </div>
  );
}

interface HistoricalAnalysisCardProps {
  analysis: SimilarAnalysis;
  rank: number;
  onClick?: () => void;
}

function HistoricalAnalysisCard({ analysis, rank, onClick }: HistoricalAnalysisCardProps) {
  const similarityPercentage = Math.round(analysis.similarity_score * 100);
  const timeAgo = formatTimeAgo(analysis.timestamp);

  // Color-code similarity scores
  const similarityColor =
    similarityPercentage >= 80 ? "text-green-600 dark:text-green-400" :
    similarityPercentage >= 60 ? "text-yellow-600 dark:text-yellow-400" :
    "text-gray-600 dark:text-gray-400";

  return (
    <Card
      className={`
        p-2 text-xs border-l-2 border-l-blue-200 dark:border-l-blue-800
        ${onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}
      `}
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-1">
            <Badge
              variant="outline"
              className="px-1 py-0 text-xs font-normal"
            >
              #{rank}
            </Badge>
            <Badge
              variant="secondary"
              className="px-1 py-0 text-xs"
            >
              {analysis.analysis_type}
            </Badge>
          </div>
          <div className={`text-xs font-medium ${similarityColor}`}>
            {similarityPercentage}%
          </div>
        </div>

        <p className="text-xs text-foreground/80 line-clamp-2 mb-1">
          {analysis.content.length > 100
            ? `${analysis.content.substring(0, 100)}...`
            : analysis.content
          }
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}</span>
          </div>
          {onClick && (
            <ArrowRight className="h-3 w-3" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Utility function to format timestamps as "time ago"
function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}