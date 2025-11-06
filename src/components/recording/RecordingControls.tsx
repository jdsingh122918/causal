import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranscription } from "@/contexts/TranscriptionContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useRecordings } from "@/contexts/RecordingsContext";
import { Mic, Square, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function RecordingControls() {
  const { state, startRecording, stopRecording, clearTranscript } = useTranscription();
  const { currentProject } = useProjects();
  const { saveRecording } = useRecordings();
  const [recordingName, setRecordingName] = useState("");
  const [saving, setSaving] = useState(false);

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

  const handleSaveRecording = async () => {
    if (!recordingName.trim()) {
      toast.error("Please enter a recording name");
      return;
    }

    if (!state.transcriptText.trim()) {
      toast.error("No transcript to save");
      return;
    }

    try {
      setSaving(true);
      // Use cleaned transcript if available, otherwise use raw transcript
      const transcriptToSave = state.cleanedTranscript || state.transcriptText;
      await saveRecording(recordingName, transcriptToSave);
      toast.success("Recording saved successfully");
      setRecordingName("");
      clearTranscript();
    } catch (error) {
      toast.error("Failed to save recording");
      console.error(error);
    } finally {
      setSaving(false);
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
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all border-2 border-primary/20"
            >
              <Mic className="h-5 w-5" />
              Start Recording
            </Button>
          ) : (
            <Button
              onClick={handleStop}
              variant="destructive"
              size="lg"
              className="gap-2 shadow-md hover:shadow-lg transition-all border-2 border-destructive/20"
            >
              <Square className="h-5 w-5" />
              Stop Recording
            </Button>
          )}
        </div>
      </div>

      {/* Save Recording Section - Shows when recording is completed and there's transcript text */}
      {state.status === "completed" && state.transcriptText.trim() && (
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-base font-semibold mb-3">Save Recording</h4>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Enter recording name..."
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveRecording()}
              className="flex-1"
            />
            <Button
              onClick={handleSaveRecording}
              disabled={!recordingName.trim() || saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Recording
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
