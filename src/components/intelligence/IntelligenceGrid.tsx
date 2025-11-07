import { useCallback, useEffect, useState } from "react";
import { useTileLayout } from "@/hooks/intelligence/use-tile-layout";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import { useTranscription } from "@/contexts/TranscriptionContext";
import { useIntelligenceAnalysis } from "@/hooks/use-intelligence";
import { SentimentTile } from "./tiles/SentimentTile";
import { FinancialTile } from "./tiles/FinancialTile";
import { CompetitiveTile } from "./tiles/CompetitiveTile";
import { SummaryTile } from "./tiles/SummaryTile";
import { RiskTile } from "./tiles/RiskTile";
import { AnalyticsTile } from "./tiles/AnalyticsTile";
import type { AnalysisType } from "@/contexts/IntelligenceContext";
import { logger } from "@/utils/logger";

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
  autoAnalyze = true,
}: IntelligenceGridProps) {
  const { layoutMode, gridClasses } = useTileLayout({ isRecording });
  const intelligence = useIntelligence();
  const transcription = useTranscription();
  const analysis = useIntelligenceAnalysis();
  const [lastAnalyzedText, setLastAnalyzedText] = useState<string>("");

  // Update backend configuration when enabledAnalyses prop changes
  useEffect(() => {
    const currentEnabledAnalyses = intelligence.state.config.enabled_analyses;
    const propEnabledAnalyses = enabledAnalyses;

    // Check if the backend config differs from the prop
    const configDifferent = currentEnabledAnalyses.length !== propEnabledAnalyses.length ||
      !currentEnabledAnalyses.every(type => propEnabledAnalyses.includes(type)) ||
      !propEnabledAnalyses.every(type => currentEnabledAnalyses.includes(type));

    if (configDifferent && intelligence.state.config.api_key) {
      logger.debug("IntelligenceGrid", `Updating backend config with ${propEnabledAnalyses.length} enabled analyses:`, propEnabledAnalyses);
      analysis.enableAnalysisTypes(propEnabledAnalyses).catch(error => {
        logger.error("IntelligenceGrid", "Failed to update enabled analysis types:", error);
      });
    }
  }, [enabledAnalyses, intelligence.state.config.enabled_analyses, intelligence.state.config.api_key, analysis]);

  // Auto-analysis logic - monitors enhanced transcript and triggers analysis
  const triggerAnalysis = useCallback(async (text: string) => {
    if (!intelligence.state.isInitialized || !autoAnalyze || !text.trim()) {
      return;
    }

    // Avoid re-analyzing the same text
    if (text === lastAnalyzedText) {
      return;
    }

    // Only analyze if text is substantial (100+ characters and ends with sentence)
    if (text.length > 100 && (text.endsWith('.') || text.endsWith('!') || text.endsWith('?'))) {
      try {
        logger.debug("IntelligenceGrid", 'Triggering auto-analysis for', text.length, 'characters');
        setLastAnalyzedText(text);
        await analysis.analyzeText(text);
      } catch (error) {
        logger.error("IntelligenceGrid", "Auto-analysis failed:", error);
      }
    }
  }, [intelligence.state.isInitialized, autoAnalyze, lastAnalyzedText, analysis]);

  // Monitor enhanced transcript for auto-analysis during recording
  useEffect(() => {
    if (!autoAnalyze || !intelligence.state.isInitialized || !isRecording) return;

    const enhancedText = Array.from(transcription.state.enhancedBuffers.values()).join(' ');
    if (enhancedText && enhancedText !== lastAnalyzedText) {
      triggerAnalysis(enhancedText);
    }
  }, [transcription.state.enhancedBuffers, triggerAnalysis, autoAnalyze, intelligence.state.isInitialized, isRecording, lastAnalyzedText]);

  // Map analysis types to tile components
  const renderTile = (analysisType: AnalysisType) => {
    const tileProps = {
      key: analysisType,
      isRecording,
      showHistorical,
      layoutMode
    };

    switch (analysisType) {
      case "Sentiment":
        return <SentimentTile {...tileProps} />;
      case "Financial":
        return <FinancialTile {...tileProps} />;
      case "Competitive":
        return <CompetitiveTile {...tileProps} />;
      case "Summary":
        return <SummaryTile {...tileProps} />;
      case "Risk":
        return <RiskTile {...tileProps} />;
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
