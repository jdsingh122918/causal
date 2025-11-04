import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranscription } from "@/contexts/TranscriptionContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function RecordingControls() {
  const { state, startRecording, stopRecording } = useTranscription();
  const { currentProject } = useProjects();

  const handleStart = async () => {
    if (!currentProject) {
      toast.error("Please select a project first");
      return;
    }

    try {
      await startRecording();
      toast.success("Recording started");
    } catch (error) {
      toast.error("Failed to start recording");
      console.error(error);
    }
  };

  const handleStop = async () => {
    try {
      await stopRecording();
      toast.success("Recording stopped");
    } catch (error) {
      toast.error("Failed to stop recording");
      console.error(error);
    }
  };

  const getStatusBadge = () => {
    switch (state.status) {
      case "recording":
        return (
          <Badge variant="destructive" className="gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
            </span>
            Recording
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      default:
        return <Badge variant="outline">Ready</Badge>;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Recording Controls</h3>
          <p className="text-sm text-muted-foreground">
            {currentProject
              ? `Recording to: ${currentProject.name}`
              : "Select a project to start recording"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          {!state.isRecording ? (
            <Button
              onClick={handleStart}
              disabled={!currentProject}
              size="lg"
              className="gap-2"
            >
              <Mic className="h-5 w-5" />
              Start Recording
            </Button>
          ) : (
            <Button
              onClick={handleStop}
              variant="destructive"
              size="lg"
              className="gap-2"
            >
              <Square className="h-5 w-5" />
              Stop Recording
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
