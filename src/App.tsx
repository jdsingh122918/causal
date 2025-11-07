import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/contexts/ProjectsContext";
import { useTranscription } from "@/contexts/TranscriptionContext";
import { useRecordingIntelligence } from "@/hooks/use-recording-intelligence";
import { RecordingControls } from "@/components/recording/RecordingControls";
import { TranscriptDisplay } from "@/components/recording/TranscriptDisplay";
import { RecordingHistory } from "@/components/recording/RecordingHistory";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { DiagnosticsPanel } from "@/components/panels/DiagnosticsPanel";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { RecordingDetailsPage } from "@/pages/RecordingDetailsPage";
import { HelpPage } from "@/pages/HelpPage";
import { IntelligenceDashboard } from "@/components/intelligence";
import { IntelligenceGrid } from "@/components/intelligence/IntelligenceGrid";
import { ProjectIntelligenceSettings } from "@/components/settings/ProjectIntelligenceSettings";

function ProjectView() {
  const { currentProject, getProjectIntelligence } = useProjects();
  const { state: transcriptionState } = useTranscription();
  const [showHistorical] = useState(false); // TODO: Add UI control to toggle historical analysis

  // Initialize recording intelligence hook for automatic analysis capture
  useRecordingIntelligence();

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md p-8 text-center">
          <h2 className="mb-2 text-2xl font-bold">Welcome to Causal</h2>
          <p className="text-muted-foreground">
            Create or select a project from the sidebar to get started with
            real-time transcription.
          </p>
        </Card>
      </div>
    );
  }

  // Get project intelligence configuration and recording state
  const intelligenceConfig = getProjectIntelligence(currentProject.id);
  const isIntelligenceEnabled = intelligenceConfig?.enabled ?? false;
  const isRecording = transcriptionState.isRecording;

  return (
    <div className="h-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Recordings for {currentProject.name}</h2>
        <div className="flex items-center gap-2">
          <ProjectIntelligenceSettings />
          {isIntelligenceEnabled && (
            <span className="text-sm text-muted-foreground bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
              Intelligence Enabled
            </span>
          )}
        </div>
      </div>

      <ErrorBoundary>
        <RecordingControls />
      </ErrorBoundary>

      {/* Main content layout */}
      {isIntelligenceEnabled ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Left column: Transcript and Recording History */}
          <div className="space-y-6">
            <ErrorBoundary>
              <TranscriptDisplay />
            </ErrorBoundary>
            <ErrorBoundary>
              <RecordingHistory isRecording={isRecording} />
            </ErrorBoundary>
          </div>

          {/* Right column: Intelligence Tiles */}
          <div className="h-full">
            <ErrorBoundary>
              <IntelligenceGrid
                enabledAnalyses={intelligenceConfig?.analyses ?? ["Sentiment", "Financial", "Competitive", "Summary", "Risk"]}
                isRecording={isRecording}
                showHistorical={showHistorical}
                autoAnalyze={intelligenceConfig?.autoAnalyze ?? true}
              />
            </ErrorBoundary>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <ErrorBoundary>
            <TranscriptDisplay />
          </ErrorBoundary>
          <ErrorBoundary>
            <RecordingHistory isRecording={isRecording} />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AppLayout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<ProjectView />} />
          <Route path="/recordings/:recordingId" element={<RecordingDetailsPage />} />
          <Route path="/intelligence" element={<IntelligenceDashboard />} />
          <Route path="/settings" element={<SettingsPanel />} />
          <Route path="/diagnostics" element={<DiagnosticsPanel />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </ErrorBoundary>
    </AppLayout>
  );
}

export default App;
