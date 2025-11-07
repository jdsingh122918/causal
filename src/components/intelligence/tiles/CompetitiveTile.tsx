import { useCallback, useEffect, useState } from "react";
import { logger } from "@/utils/logger";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IntelligenceTile } from "../IntelligenceTile";
import { HistoricalContext } from "../HistoricalContext";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import { useHistoricalContext } from "@/hooks/use-historical-context";
import type { LayoutMode } from "@/hooks/intelligence/use-tile-layout";
import type { IntelligenceResult } from "@/contexts/IntelligenceContext";

interface CompetitiveTileProps {
  isRecording: boolean;
  showHistorical?: boolean;
  layoutMode: LayoutMode;
}

export function CompetitiveTile({ isRecording, showHistorical, layoutMode }: CompetitiveTileProps) {
  const intelligence = useIntelligence();
  const [latestResult, setLatestResult] = useState<IntelligenceResult | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Historical context for similar competitive analyses
  const {
    similarAnalyses,
    isLoading: isLoadingHistory,
    error: historyError
  } = useHistoricalContext({
    text: latestResult?.raw_text || "",
    analysisType: "Competitive",
    enabled: showHistorical && !!latestResult?.raw_text,
    topK: 3,
    minSimilarity: 0.6
  });

  useEffect(() => {
    const results = Array.from(intelligence.state.latestResults.values());
    if (results.length > 0) {
      const latest = results[results.length - 1];
      const competitiveResult = latest.results["Competitive"];

      if (competitiveResult && competitiveResult !== latestResult) {
        setLatestResult(competitiveResult);
        setIsNew(true);
        setTimeout(() => setIsNew(false), 30000);
      }
    }
  }, [intelligence.state.latestResults, latestResult]);

  const isNewContent = useCallback((timestamp: string): boolean => {
    const resultTime = new Date(timestamp).getTime();
    const thirtySecondsAgo = Date.now() - 30 * 1000;
    return resultTime > thirtySecondsAgo;
  }, []);

  const renderContent = () => {
    if (!latestResult?.competitive) {
      return (
        <div className="flex items-center justify-center h-full text-center p-4">
          <p className="text-sm text-muted-foreground">
            {isRecording ? "Analyzing competitive data..." : "No competitive data available"}
          </p>
        </div>
      );
    }

    const competitive = latestResult.competitive;

    return (
      <div className="space-y-3">
        {/* Competitors Mentioned */}
        {competitive.competitors_mentioned.length > 0 && (
          <div>
            <span className="text-sm font-medium">Competitors:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {competitive.competitors_mentioned.map((competitor, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {competitor}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Competitive Advantages */}
        {competitive.competitive_advantages.length > 0 && (
          <div>
            <span className="text-sm font-medium">Advantages:</span>
            <ul className="mt-1 space-y-1 text-xs list-disc list-inside">
              {competitive.competitive_advantages.slice(0, layoutMode === "compact" ? 2 : 4).map((advantage, idx) => (
                <li key={idx} className="text-muted-foreground">{advantage}</li>
              ))}
            </ul>
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
        logger.debug('Competitive', 'Historical analysis clicked:', analysis);
      }}
    />
  ) : undefined;

  return (
    <IntelligenceTile
      analysisType="Competitive"
      icon={Users}
      color="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
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
