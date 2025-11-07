import { useCallback, useEffect, useState } from "react";
import { logger } from "@/utils/logger";
import { DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IntelligenceTile } from "../IntelligenceTile";
import { HistoricalContext } from "../HistoricalContext";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import { useHistoricalContext } from "@/hooks/use-historical-context";
import type { LayoutMode } from "@/hooks/intelligence/use-tile-layout";
import type { IntelligenceResult } from "@/contexts/IntelligenceContext";

interface FinancialTileProps {
  isRecording: boolean;
  showHistorical?: boolean;
  layoutMode: LayoutMode;
}

export function FinancialTile({ isRecording, showHistorical, layoutMode }: FinancialTileProps) {
  const intelligence = useIntelligence();
  const [latestResult, setLatestResult] = useState<IntelligenceResult | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Historical context for similar financial analyses
  const {
    similarAnalyses,
    isLoading: isLoadingHistory,
    error: historyError
  } = useHistoricalContext({
    text: latestResult?.raw_text || "",
    analysisType: "Financial",
    enabled: showHistorical && !!latestResult?.raw_text,
    topK: 3,
    minSimilarity: 0.6
  });

  useEffect(() => {
    const results = Array.from(intelligence.state.latestResults.values());
    if (results.length > 0) {
      const latest = results[results.length - 1];
      const financialResult = latest.results["Financial"];

      if (financialResult && financialResult !== latestResult) {
        setLatestResult(financialResult);
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
    if (!latestResult?.financial) {
      return (
        <div className="flex items-center justify-center h-full text-center p-4">
          <p className="text-sm text-muted-foreground">
            {isRecording ? "Analyzing financial data..." : "No financial data available"}
          </p>
        </div>
      );
    }

    const financial = latestResult.financial;
    const maxMetrics = layoutMode === "compact" ? 3 : 5;

    return (
      <div className="space-y-3">
        {/* Financial Metrics */}
        {Object.keys(financial.metrics).length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Metrics:</span>
            {Object.entries(financial.metrics).slice(0, maxMetrics).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground capitalize">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="font-mono font-medium">{value}</span>
              </div>
            ))}
            {Object.keys(financial.metrics).length > maxMetrics && (
              <p className="text-xs text-muted-foreground">
                +{Object.keys(financial.metrics).length - maxMetrics} more metrics
              </p>
            )}
          </div>
        )}

        {/* Currencies Detected */}
        {financial.currencies.length > 0 && (
          <div>
            <span className="text-sm font-medium">Currencies:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {financial.currencies.slice(0, 4).map((currency, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {currency}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Financial Terms */}
        {financial.financial_terms.length > 0 && layoutMode !== "compact" && (
          <div>
            <span className="text-sm font-medium">Financial Terms:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {financial.financial_terms.slice(0, 3).map((term, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {term}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Financial Outlook */}
        {financial.outlook && (
          <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
            <span className="text-xs font-semibold text-green-700 dark:text-green-300">Outlook:</span>
            <p className="text-xs text-green-900 dark:text-green-200 mt-1">
              {financial.outlook}
            </p>
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
        logger.debug('Financial', 'Historical analysis clicked:', analysis);
      }}
    />
  ) : undefined;

  return (
    <IntelligenceTile
      analysisType="Financial"
      icon={DollarSign}
      color="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
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
