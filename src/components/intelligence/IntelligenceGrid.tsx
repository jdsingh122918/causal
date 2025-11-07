import { useTileLayout } from "@/hooks/intelligence/use-tile-layout";
import { SentimentTile } from "./tiles/SentimentTile";
import { FinancialTile } from "./tiles/FinancialTile";
import { CompetitiveTile } from "./tiles/CompetitiveTile";
import { SummaryTile } from "./tiles/SummaryTile";
import { RiskTile } from "./tiles/RiskTile";
import { AnalyticsTile } from "./tiles/AnalyticsTile";
import type { AnalysisType } from "@/contexts/IntelligenceContext";

interface IntelligenceGridProps {
  enabledAnalyses: AnalysisType[];
  isRecording: boolean;
  showHistorical?: boolean;
  autoAnalyze?: boolean;
}

export function IntelligenceGrid({
  enabledAnalyses,
  isRecording,
  showHistorical = false,
}: IntelligenceGridProps) {
  const { layoutMode, gridClasses } = useTileLayout({ isRecording });

  // Map analysis types to tile components
  const renderTile = (analysisType: AnalysisType) => {
    const tileProps = {
      isRecording,
      showHistorical,
      layoutMode
    };

    switch (analysisType) {
      case "Sentiment":
        return <SentimentTile key={analysisType} {...tileProps} />;
      case "Financial":
        return <FinancialTile key={analysisType} {...tileProps} />;
      case "Competitive":
        return <CompetitiveTile key={analysisType} {...tileProps} />;
      case "Summary":
        return <SummaryTile key={analysisType} {...tileProps} />;
      case "Risk":
        return <RiskTile key={analysisType} {...tileProps} />;
      default:
        return null;
    }
  };

  return (
    <div className={`h-full overflow-y-auto ${isRecording ? 'pb-4' : 'pb-6'}`}>
      <div className={gridClasses}>
        {/* Render enabled analysis tiles */}
        {enabledAnalyses.map(renderTile)}

        {/* Analytics tile (always visible when historical data is shown) */}
        {showHistorical && (
          <AnalyticsTile
            isRecording={isRecording}
            layoutMode={layoutMode}
          />
        )}
      </div>
    </div>
  );
}
