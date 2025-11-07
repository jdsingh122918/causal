import { useCallback, useEffect, useState } from "react";
import { logger } from "@/utils/logger";
import { Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IntelligenceTile } from "../IntelligenceTile";
import { HistoricalContext } from "../HistoricalContext";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import { useHistoricalContext } from "@/hooks/use-historical-context";
import type { LayoutMode } from "@/hooks/intelligence/use-tile-layout";
import type { IntelligenceResult } from "@/contexts/IntelligenceContext";

interface SentimentTileProps {
  isRecording: boolean;
  showHistorical?: boolean;
  layoutMode: LayoutMode;
}

export function SentimentTile({ isRecording, showHistorical, layoutMode }: SentimentTileProps) {
  const intelligence = useIntelligence();
  const [latestResult, setLatestResult] = useState<IntelligenceResult | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Historical context for similar sentiment analyses
  const {
    similarAnalyses,
    isLoading: isLoadingHistory,
    error: historyError
  } = useHistoricalContext({
    text: latestResult?.raw_text || "",
    analysisType: "Sentiment",
    enabled: showHistorical && !!latestResult?.raw_text,
    topK: 3,
    minSimilarity: 0.6
  });

  // Get latest sentiment analysis from combined results
  useEffect(() => {
    const results = Array.from(intelligence.state.latestResults.values());
    if (results.length > 0) {
      const latest = results[results.length - 1];
      const sentimentResult = latest.results["Sentiment"];

      if (sentimentResult && sentimentResult !== latestResult) {
        setLatestResult(sentimentResult);
        setIsNew(true);

        // Remove "new" indicator after 30 seconds
        setTimeout(() => setIsNew(false), 30000);
      }
    }
  }, [intelligence.state.latestResults, latestResult]);

  // Check if result is new (within last 30 seconds)
  const isNewContent = useCallback((timestamp: string): boolean => {
    const resultTime = new Date(timestamp).getTime();
    const thirtySecondsAgo = Date.now() - 30 * 1000;
    return resultTime > thirtySecondsAgo;
  }, []);

  const renderContent = () => {
    if (!latestResult?.sentiment) {
      return (
        <div className="flex items-center justify-center h-full text-center p-4">
          <p className="text-sm text-muted-foreground">
            {isRecording ? "Analyzing sentiment..." : "No sentiment data available"}
          </p>
        </div>
      );
    }

    const sentiment = latestResult.sentiment;

    return (
      <div className="space-y-3">
        {/* Overall Sentiment */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall:</span>
          <Badge className="bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">
            {sentiment.overall_sentiment}
          </Badge>
        </div>

        {/* Confidence Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Confidence:</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-pink-500 transition-all duration-300"
                style={{ width: `${sentiment.confidence * 100}%` }}
              />
            </div>
            <span className="text-sm font-mono">{Math.round(sentiment.confidence * 100)}%</span>
          </div>
        </div>

        {/* Emotional Tone */}
        {sentiment.emotional_tone.length > 0 && (
          <div>
            <span className="text-sm font-medium">Emotional Tone:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {sentiment.emotional_tone.slice(0, 4).map((tone, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tone}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Key Phrases */}
        {sentiment.key_phrases.length > 0 && (
          <div>
            <span className="text-sm font-medium">Key Phrases:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {sentiment.key_phrases.slice(0, layoutMode === "compact" ? 2 : 4).map((phrase, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {phrase}
                </Badge>
              ))}
              {sentiment.key_phrases.length > (layoutMode === "compact" ? 2 : 4) && (
                <Badge variant="outline" className="text-xs">
                  +{sentiment.key_phrases.length - (layoutMode === "compact" ? 2 : 4)} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Create historical content component if enabled and data available
  const historicalContent = showHistorical ? (
    <HistoricalContext
      similarAnalyses={historyError ? [] : similarAnalyses}
      isLoading={isLoadingHistory}
      onAnalysisClick={(analysis) => {
        logger.debug('Sentiment', 'Historical analysis clicked:', analysis);
      }}
    />
  ) : undefined;

  return (
    <IntelligenceTile
      analysisType="Sentiment"
      icon={Heart}
      color="bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200"
      isRecording={isRecording}
      layoutMode={layoutMode}
      showHistorical={showHistorical}
      historicalContent={historicalContent}
      isNew={isNew && latestResult ? isNewContent(latestResult.timestamp) : false}
      timestamp={latestResult?.timestamp}
    >
      {renderContent()}
    </IntelligenceTile>
  );
}
