import { useCallback, useEffect, useState } from "react";
import { useTranscription } from "@/contexts/TranscriptionContext";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import { useRecordings } from "@/contexts/RecordingsContext";
import type {
  IntelligenceResult,
  AnalysisType,
} from "@/contexts/IntelligenceContext";

export interface RecordingAnalysisSnapshot {
  timestamp: string;
  transcriptLength: number;
  analysisResults: Record<AnalysisType, IntelligenceResult>;
  summary: {
    totalAnalyses: number;
    enabledTypes: AnalysisType[];
    lastUpdated: string;
  };
}

export function useRecordingIntelligence() {
  const transcription = useTranscription();
  const intelligence = useIntelligence();
  const recordings = useRecordings();

  const [recordingAnalysis, setRecordingAnalysis] =
    useState<RecordingAnalysisSnapshot | null>(null);
  const [isCapturingAnalysis, setIsCapturingAnalysis] = useState(false);

  // Capture current analysis state as a snapshot
  const captureAnalysisSnapshot =
    useCallback((): RecordingAnalysisSnapshot | null => {
      const results = Array.from(intelligence.state.latestResults.values());
      if (results.length === 0) {
        return null;
      }

      const latestResult = results[results.length - 1];
      const transcriptText = transcription.state.transcriptText;

      const snapshot: RecordingAnalysisSnapshot = {
        timestamp: new Date().toISOString(),
        transcriptLength: transcriptText.length,
        analysisResults: latestResult.results,
        summary: {
          totalAnalyses: results.length,
          enabledTypes: Object.keys(latestResult.results) as AnalysisType[],
          lastUpdated: latestResult.timestamp,
        },
      };

      return snapshot;
    }, [intelligence.state.latestResults, transcription.state.transcriptText]);

  // Attach analysis snapshot to the current recording
  const attachAnalysisToRecording = useCallback(
    async (recordingId: string, snapshot: RecordingAnalysisSnapshot) => {
      try {
        setIsCapturingAnalysis(true);

        // Store analysis data with recording (this will be implemented in RecordingsContext)
        if (recordings.attachIntelligenceAnalysis) {
          await recordings.attachIntelligenceAnalysis(recordingId, snapshot);
        } else {
          console.warn(
            "attachIntelligenceAnalysis method not available in RecordingsContext",
          );
        }

        console.log(
          `✅ Analysis attached to recording ${recordingId}:`,
          snapshot,
        );

        // Clear intelligence state after successful persistence
        console.log("🧹 Clearing intelligence state after persistence");
        intelligence.clearResults();
      } catch (error) {
        console.error("Failed to attach analysis to recording:", error);
        throw error;
      } finally {
        setIsCapturingAnalysis(false);
      }
    },
    [recordings, intelligence],
  );

  // Automatically capture and persist analysis when recording stops
  useEffect(() => {
    // Listen for recording stop events
    if (
      !transcription.state.isRecording &&
      transcription.state.status === "completed" &&
      intelligence.state.isInitialized &&
      recordingAnalysis === null
    ) {
      // Only capture once per recording session

      console.log("Recording stopped - capturing analysis snapshot");
      const snapshot = captureAnalysisSnapshot();

      if (snapshot) {
        setRecordingAnalysis(snapshot);

        // Find the most recent recording and attach analysis
        const recentRecordings = recordings.recordings.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        if (recentRecordings.length > 0) {
          const mostRecentRecording = recentRecordings[0];
          attachAnalysisToRecording(mostRecentRecording.id, snapshot).catch(
            (error) => {
              console.error("Failed to auto-attach analysis:", error);
            },
          );
        }
      }
    }

    // Reset analysis state when new recording starts
    if (
      transcription.state.isRecording &&
      transcription.state.status === "recording"
    ) {
      setRecordingAnalysis(null);
    }
  }, [
    transcription.state.isRecording,
    transcription.state.status,
    intelligence.state.isInitialized,
    captureAnalysisSnapshot,
    attachAnalysisToRecording,
    recordings.recordings,
    recordingAnalysis,
  ]);

  // Get analysis for a specific recording
  const getRecordingAnalysis = useCallback(
    async (recordingId: string): Promise<RecordingAnalysisSnapshot | null> => {
      try {
        if (recordings.getIntelligenceAnalysis) {
          return await recordings.getIntelligenceAnalysis(recordingId);
        } else {
          console.warn(
            "getIntelligenceAnalysis method not available in RecordingsContext",
          );
          return null;
        }
      } catch (error) {
        console.error("Failed to get recording analysis:", error);
        return null;
      }
    },
    [recordings],
  );

  // Export analysis with transcript
  const exportRecordingWithAnalysis = useCallback(
    async (recordingId: string): Promise<string | null> => {
      try {
        const recording = recordings.recordings.find(
          (r) => r.id === recordingId,
        );
        const analysis = await getRecordingAnalysis(recordingId);

        if (!recording) {
          throw new Error("Recording not found");
        }

        let exportData = `# Recording: ${recording.name}\n\n`;
        exportData += `**Created:** ${new Date(recording.created_at * 1000).toLocaleString()}\n`;
        exportData += `**Duration:** ${Math.round(recording.metadata.duration_seconds || 0)}s\n\n`;

        // Add transcript (prefer enhanced over raw)
        exportData += `## Transcript\n\n`;
        const transcript =
          recording.enhanced_transcript || recording.raw_transcript;
        exportData += `${transcript}\n\n`;

        // Add analysis if available
        if (analysis) {
          exportData += `## AI Analysis\n\n`;
          exportData += `**Analysis Date:** ${new Date(analysis.timestamp).toLocaleString()}\n`;
          exportData += `**Transcript Length:** ${analysis.transcriptLength} characters\n`;
          exportData += `**Analysis Types:** ${analysis.summary.enabledTypes.join(", ")}\n\n`;

          // Add each analysis type
          Object.entries(analysis.analysisResults).forEach(([type, result]) => {
            if (result) {
              exportData += `### ${type} Analysis\n\n`;
              exportData += formatAnalysisResult(type as AnalysisType, result);
              exportData += `\n\n`;
            }
          });
        }

        return exportData;
      } catch (error) {
        console.error("Failed to export recording with analysis:", error);
        return null;
      }
    },
    [recordings.recordings, getRecordingAnalysis],
  );

  return {
    recordingAnalysis,
    isCapturingAnalysis,
    captureAnalysisSnapshot,
    attachAnalysisToRecording,
    getRecordingAnalysis,
    exportRecordingWithAnalysis,
  };
}

// Helper function to format analysis results for export
function formatAnalysisResult(
  type: AnalysisType,
  result: IntelligenceResult,
): string {
  let formatted = "";

  switch (type) {
    case "Sentiment":
      if (result.sentiment) {
        formatted += `**Overall Sentiment:** ${result.sentiment.overall_sentiment}\n`;
        formatted += `**Confidence:** ${Math.round(result.sentiment.confidence * 100)}%\n`;
        if (result.sentiment.key_phrases.length > 0) {
          formatted += `**Key Phrases:** ${result.sentiment.key_phrases.join(", ")}\n`;
        }
      }
      break;

    case "Financial":
      if (result.financial) {
        formatted += `**Financial Metrics:**\n`;
        Object.entries(result.financial.metrics).forEach(([key, value]) => {
          formatted += `- ${key.replace("_", " ")}: ${value}\n`;
        });
        if (result.financial.outlook) {
          formatted += `**Outlook:** ${result.financial.outlook}\n`;
        }
      }
      break;

    case "Summary":
      if (result.summary) {
        formatted += `**Key Points:**\n`;
        result.summary.key_points.forEach((point) => {
          formatted += `- ${point}\n`;
        });
        if (result.summary.action_items.length > 0) {
          formatted += `**Action Items:**\n`;
          result.summary.action_items.forEach((item) => {
            formatted += `- ${item}\n`;
          });
        }
      }
      break;

    case "Risk":
      if (result.risk) {
        formatted += `**Risk Level:** ${result.risk.risk_level}\n`;
        if (result.risk.risks_identified.length > 0) {
          formatted += `**Risks Identified:**\n`;
          result.risk.risks_identified.forEach((risk) => {
            formatted += `- ${risk}\n`;
          });
        }
      }
      break;

    case "Competitive":
      if (result.competitive) {
        if (result.competitive.competitors_mentioned.length > 0) {
          formatted += `**Competitors Mentioned:** ${result.competitive.competitors_mentioned.join(", ")}\n`;
        }
        if (result.competitive.competitive_advantages.length > 0) {
          formatted += `**Competitive Advantages:**\n`;
          result.competitive.competitive_advantages.forEach((advantage) => {
            formatted += `- ${advantage}\n`;
          });
        }
      }
      break;
  }

  return formatted;
}
