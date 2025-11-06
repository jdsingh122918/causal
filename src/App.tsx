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
import { IntelligenceDashboard } from "@/components/intelligence";
import { IntelligenceSidebar } from "@/components/intelligence/IntelligenceSidebar";
import { ProjectIntelligenceSettings } from "@/components/settings/ProjectIntelligenceSettings";

function ProjectView() {
  const { currentProject, getProjectIntelligence } = useProjects();
  const { state: transcriptionState } = useTranscription();
  const [sidebarVisible, setSidebarVisible] = useState(false);

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
          <ProjectIntelligenceSettings projectId={currentProject.id} />
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

      <div className="flex gap-6 h-full">
        {/* Main content area */}
        <div className={`flex-1 grid gap-6 ${
          isRecording
            ? "grid-cols-1"
            : isIntelligenceEnabled && sidebarVisible
            ? "grid-cols-1 xl:grid-cols-2"
            : "grid-cols-1 lg:grid-cols-2"
        }`}>
          <ErrorBoundary>
            <TranscriptDisplay />
          </ErrorBoundary>
          <ErrorBoundary>
            <RecordingHistory isRecording={isRecording} />
          </ErrorBoundary>
        </div>

        {/* Intelligence Sidebar */}
        {isIntelligenceEnabled && (
          <ErrorBoundary>
            <IntelligenceSidebar
              isVisible={sidebarVisible}
              onToggle={() => setSidebarVisible(!sidebarVisible)}
              autoAnalyze={intelligenceConfig?.autoAnalyze ?? true}
              enabledAnalyses={intelligenceConfig?.analyses ?? ["Sentiment", "Financial", "Competitive", "Summary", "Risk"]}
            />
          </ErrorBoundary>
        )}
      </div>
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
        </Routes>
      </ErrorBoundary>
    </AppLayout>
  );
}

export default App;
