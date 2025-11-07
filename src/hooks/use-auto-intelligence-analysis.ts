import { useCallback, useEffect, useState } from "react";
import { useTranscription } from "@/contexts/TranscriptionContext";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import { useIntelligenceAnalysis } from "@/hooks/use-intelligence";
import { logger } from "@/utils/logger";

interface UseAutoIntelligenceAnalysisProps {
  enabled?: boolean;
  autoAnalyze?: boolean;
}

/**
 * Hook to automatically trigger intelligence analysis during live transcription
 * This provides the same auto-analysis functionality that was in IntelligenceSidebar
 * but as a reusable hook that can be used with any component.
 */
export function useAutoIntelligenceAnalysis({
  enabled = true,
  autoAnalyze = true,
}: UseAutoIntelligenceAnalysisProps = {}) {
  const transcription = useTranscription();
  const intelligence = useIntelligence();
  const analysis = useIntelligenceAnalysis({});
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");

  // Auto-analysis logic
  const triggerAnalysis = useCallback(
    async (text: string) => {
      if (
        !intelligence.state.isInitialized ||
        !autoAnalyze ||
        !enabled ||
        !text.trim()
      ) {
        return;
      }

      // Avoid re-analyzing the same text
      if (text === lastAnalyzedText) {
        return;
      }

      // Only analyze if text is substantial (100+ characters and ends with sentence)
      if (
        text.length > 100 &&
        (text.endsWith(".") || text.endsWith("!") || text.endsWith("?"))
      ) {
        try {
          logger.debug(
            "AutoIntelligenceAnalysis",
            `Triggering analysis for ${text.length} characters`,
          );
          setLastAnalyzedText(text);
          await analysis.analyzeText(text);
          logger.debug(
            "AutoIntelligenceAnalysis",
            "Analysis completed successfully",
          );
        } catch (error) {
          logger.error(
            "AutoIntelligenceAnalysis",
            "Auto-analysis failed:",
            error,
          );
        }
      }
    },
    [
      intelligence.state.isInitialized,
      autoAnalyze,
      enabled,
      lastAnalyzedText,
      analysis,
    ],
  );

  // Monitor enhanced transcript for auto-analysis
  useEffect(() => {
    if (!autoAnalyze || !enabled || !intelligence.state.isInitialized) return;

    const enhancedText = Array.from(
      transcription.state.enhancedBuffers.values(),
    ).join(" ");
    if (enhancedText && enhancedText !== lastAnalyzedText) {
      logger.debug(
        "AutoIntelligenceAnalysis",
        `Enhanced text updated: ${enhancedText.length} characters`,
      );
      triggerAnalysis(enhancedText);
    }
  }, [
    transcription.state.enhancedBuffers,
    triggerAnalysis,
    autoAnalyze,
    enabled,
    intelligence.state.isInitialized,
    lastAnalyzedText,
  ]);

  return {
    isAutoAnalyzing: intelligence.state.isProcessing,
    lastAnalyzedText,
    triggerAnalysis,
  };
}
