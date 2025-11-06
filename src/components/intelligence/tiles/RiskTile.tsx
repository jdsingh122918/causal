import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IntelligenceTile } from "../IntelligenceTile";
import { HistoricalContext } from "../HistoricalContext";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import { useHistoricalContext } from "@/hooks/use-historical-context";
import type { LayoutMode } from "@/hooks/intelligence/use-tile-layout";
import type { IntelligenceResult } from "@/contexts/IntelligenceContext";

interface RiskTileProps {
  isRecording: boolean;
  showHistorical?: boolean;
  layoutMode: LayoutMode;
}

export function RiskTile({ isRecording, showHistorical, layoutMode }: RiskTileProps) {
  const intelligence = useIntelligence();
  const [latestResult, setLatestResult] = useState<IntelligenceResult | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Historical context for similar risk analyses
  const {
    similarAnalyses,
    isLoading: isLoadingHistory,
    error: historyError
  } = useHistoricalContext({
    text: latestResult?.raw_text || "",
    analysisType: "Risk",
    enabled: showHistorical && !!latestResult?.raw_text,
    topK: 3,
    minSimilarity: 0.6
  });

  useEffect(() => {
    const results = Array.from(intelligence.state.latestResults.values());
    if (results.length > 0) {
      const latest = results[results.length - 1];
      const riskResult = latest.results["Risk"];

      if (riskResult && riskResult !== latestResult) {
        setLatestResult(riskResult);
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
    if (!latestResult?.risk) {
      return (
        <div className="flex items-center justify-center h-full text-center p-4">
          <p className="text-sm text-muted-foreground">
            {isRecording ? "Analyzing risks..." : "No risk data available"}
          </p>
        </div>
      );
    }

    const risk = latestResult.risk;

    return (
      <div className="space-y-3">
        {/* Overall Risk Level */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Risk Level:</span>
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            {risk.overall_risk_level}
          </Badge>
        </div>

        {/* Risk Summary */}
        {risk.risk_summary && (
          <div>
            <span className="text-sm font-medium">Summary:</span>
            <p className="text-xs text-muted-foreground mt-1">{risk.risk_summary}</p>
          </div>
        )}

        {/* Critical Risks */}
        {risk.critical_risks && risk.critical_risks.length > 0 && (
          <div>
            <span className="text-sm font-medium">Critical Risks:</span>
            <ul className="mt-1 space-y-1 text-xs list-disc list-inside">
              {risk.critical_risks.slice(0, layoutMode === "compact" ? 2 : 4).map((criticalRisk, idx) => (
                <li key={idx} className="text-red-600 dark:text-red-400">{criticalRisk}</li>
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
        console.log('[Risk Tile] Historical analysis clicked:', analysis);
      }}
    />
  ) : undefined;

  return (
    <IntelligenceTile
      analysisType="Risk"
      icon={AlertTriangle}
      color="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
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
