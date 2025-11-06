import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/contexts/ProjectsContext";
import { RecordingControls } from "@/components/recording/RecordingControls";
import { TranscriptDisplay } from "@/components/recording/TranscriptDisplay";
import { RecordingHistory } from "@/components/recording/RecordingHistory";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

// Lazy load components that aren't needed immediately
const SettingsPanel = lazy(() => import("@/components/panels/SettingsPanel"));
const DiagnosticsPanel = lazy(() => import("@/components/panels/DiagnosticsPanel"));
const RecordingDetailsPage = lazy(() => import("@/pages/RecordingDetailsPage"));

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

function LoadingSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
    </div>
  );
}

function App() {
  return (
    <AppLayout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<ProjectView />} />
          <Route
            path="/recordings/:recordingId"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <RecordingDetailsPage />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <SettingsPanel />
              </Suspense>
            }
          />
          <Route
            path="/diagnostics"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <DiagnosticsPanel />
              </Suspense>
            }
          />
        </Routes>
      </ErrorBoundary>
    </AppLayout>
  );
}

export default App;
