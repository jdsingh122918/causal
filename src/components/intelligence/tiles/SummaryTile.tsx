import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { IntelligenceTile } from "../IntelligenceTile";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import type { LayoutMode } from "@/hooks/intelligence/use-tile-layout";
import type { IntelligenceResult } from "@/contexts/IntelligenceContext";

interface SummaryTileProps {
  isRecording: boolean;
  showHistorical?: boolean;
  layoutMode: LayoutMode;
}

export function SummaryTile({ isRecording, showHistorical, layoutMode }: SummaryTileProps) {
  const intelligence = useIntelligence();
  const [latestResult, setLatestResult] = useState<IntelligenceResult | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const results = Array.from(intelligence.state.latestResults.values());
    if (results.length > 0) {
      const latest = results[results.length - 1];
      const summaryResult = latest.results["Summary"];

      if (summaryResult && summaryResult !== latestResult) {
        setLatestResult(summaryResult);
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
    if (!latestResult?.summary) {
      return (
        <div className="flex items-center justify-center h-full text-center p-4">
          <p className="text-sm text-muted-foreground">
            {isRecording ? "Generating summary..." : "No summary available"}
          </p>
        </div>
      );
    }

    const summary = latestResult.summary;
    const maxKeyPoints = layoutMode === "compact" ? 2 : 4;

    return (
      <div className="space-y-3">
        {/* Key Points */}
        {summary.key_points.length > 0 && (
          <div>
            <span className="text-sm font-medium">Key Points:</span>
            <ul className="mt-1 space-y-1 text-xs list-disc list-inside">
              {summary.key_points.slice(0, maxKeyPoints).map((point, idx) => (
                <li key={idx} className="text-muted-foreground">{point}</li>
              ))}
            </ul>
            {summary.key_points.length > maxKeyPoints && (
              <p className="text-xs text-muted-foreground mt-1">
                +{summary.key_points.length - maxKeyPoints} more points
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <IntelligenceTile
      analysisType="Summary"
      icon={FileText}
      color="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      isRecording={isRecording}
      layoutMode={layoutMode}
      showHistorical={showHistorical}
      isNew={isNew && latestResult ? isNewContent(latestResult.timestamp) : false}
      timestamp={latestResult?.timestamp}
    >
      {renderContent()}
    </IntelligenceTile>
  );
}
