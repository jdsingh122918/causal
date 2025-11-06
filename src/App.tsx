import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/contexts/ProjectsContext";
import { RecordingControls } from "@/components/recording/RecordingControls";
import { TranscriptDisplay } from "@/components/recording/TranscriptDisplay";
import { RecordingHistory } from "@/components/recording/RecordingHistory";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { DiagnosticsPanel } from "@/components/panels/DiagnosticsPanel";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { RecordingDetailsPage } from "@/pages/RecordingDetailsPage";
import { IntelligenceDashboard } from "@/components/intelligence";

function ProjectView() {
  const { currentProject } = useProjects();

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

  return (
    <div className="h-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Recordings for {currentProject.name}</h2>
      </div>

      <ErrorBoundary>
        <RecordingControls />
      </ErrorBoundary>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ErrorBoundary>
          <TranscriptDisplay />
        </ErrorBoundary>
        <ErrorBoundary>
          <RecordingHistory />
        </ErrorBoundary>
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
