import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/contexts/ProjectsContext";
import { RecordingControls } from "@/components/recording/RecordingControls";
import { TranscriptDisplay } from "@/components/recording/TranscriptDisplay";
import { RecordingHistory } from "@/components/recording/RecordingHistory";
import { SummaryView } from "@/components/summary/SummaryView";

function App() {
  const { currentProject } = useProjects();

  if (!currentProject) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <Card className="max-w-md p-8 text-center">
            <h2 className="mb-2 text-2xl font-bold">Welcome to Causal</h2>
            <p className="text-muted-foreground">
              Create or select a project from the sidebar to get started with
              real-time transcription.
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full space-y-6">
        <Tabs defaultValue="recording" className="h-full">
          <TabsList>
            <TabsTrigger value="recording">Recording</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="recording" className="space-y-6">
            <RecordingControls />
            <TranscriptDisplay />
            <RecordingHistory />
          </TabsContent>

          <TabsContent value="summary" className="space-y-6">
            <SummaryView />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default App;
