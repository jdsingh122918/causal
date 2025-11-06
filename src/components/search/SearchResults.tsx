import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  TrendingUp,
  FileText,
  Eye,
  Heart,
  DollarSign,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import type { SimilarAnalysis } from "@/contexts/IntelligenceContext";

interface SearchResultsProps {
  results: SimilarAnalysis[];
  query: string;
  isLoading?: boolean;
  onResultClick?: (result: SimilarAnalysis) => void;
}

export function SearchResults({
  results,
  query,
  isLoading = false,
  onResultClick
}: SearchResultsProps) {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  if (isLoading) {
    return <SearchResultsLoading />;
  }

  if (!query) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Search Your Analyses</h3>
        <p className="text-muted-foreground">
          Use natural language to find similar analyses across your recordings
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">No Results Found</h3>
        <p className="text-muted-foreground">
          Try different keywords or adjust your search filters
        </p>
      </div>
    );
  }

  const toggleExpanded = (resultId: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Search Results for "{query}"
        </h3>
        <Badge variant="secondary" className="text-sm">
          {results.length} result{results.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="space-y-3">
        {results.map((result, index) => (
          <SearchResultCard
            key={result.id}
            result={result}
            rank={index + 1}
            isExpanded={expandedResults.has(result.id)}
            onToggleExpanded={() => toggleExpanded(result.id)}
            onClick={() => onResultClick?.(result)}
          />
        ))}
      </div>
    </div>
  );
}

interface SearchResultCardProps {
  result: SimilarAnalysis;
  rank: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onClick?: () => void;
}

function SearchResultCard({
  result,
  rank,
  isExpanded,
  onToggleExpanded,
  onClick
}: SearchResultCardProps) {
  const similarityPercentage = Math.round(result.similarity_score * 100);
  const timeAgo = formatTimeAgo(result.timestamp);

  // Get analysis type icon and color
  const analysisConfig = getAnalysisConfig(result.analysis_type);
  const Icon = analysisConfig.icon;

  // Color-code similarity scores
  const similarityColor = getSimilarityColor(similarityPercentage);

  // Truncate content for preview
  const previewContent = result.content.length > 200
    ? `${result.content.substring(0, 200)}...`
    : result.content;

  return (
    <Card className="transition-colors hover:bg-muted/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Rank Badge */}
            <Badge variant="outline" className="text-xs shrink-0">
              #{rank}
            </Badge>

            {/* Analysis Type */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`p-1.5 rounded-md ${analysisConfig.bgColor}`}>
                <Icon className="h-3 w-3" />
              </div>
              <Badge variant="secondary" className="text-xs">
                {result.analysis_type}
              </Badge>
            </div>

            {/* Similarity Score */}
            <div className="ml-auto shrink-0">
              <Badge
                variant="outline"
                className={`text-xs font-medium ${similarityColor}`}
              >
                {similarityPercentage}% match
              </Badge>
            </div>
          </div>
        </div>

        {/* Metadata Row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}</span>
          </div>
          {result.recording_id && (
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>Recording</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>Relevance</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Content Preview */}
        <div className="space-y-3">
          <p className="text-sm text-foreground leading-relaxed">
            {isExpanded ? result.content : previewContent}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {result.content.length > 200 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpanded}
                  className="text-xs h-7 px-2"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show More
                    </>
                  )}
                </Button>
              )}
            </div>

            {onClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClick}
                className="text-xs h-7 px-2"
              >
                <Eye className="h-3 w-3 mr-1" />
                View Details
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SearchResultsLoading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Utility functions
function getAnalysisConfig(analysisType: string) {
  switch (analysisType.toLowerCase()) {
    case 'sentiment':
      return {
        icon: Heart,
        bgColor: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
      };
    case 'financial':
      return {
        icon: DollarSign,
        bgColor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      };
    case 'competitive':
      return {
        icon: Users,
        bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      };
    case 'summary':
      return {
        icon: FileText,
        bgColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      };
    case 'risk':
      return {
        icon: AlertTriangle,
        bgColor: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      };
    default:
      return {
        icon: FileText,
        bgColor: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      };
  }
}

function getSimilarityColor(percentage: number): string {
  if (percentage >= 80) return "text-green-600 dark:text-green-400";
  if (percentage >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-gray-600 dark:text-gray-400";
}

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