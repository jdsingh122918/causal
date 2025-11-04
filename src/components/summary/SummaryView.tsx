import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRecordings } from "@/contexts/RecordingsContext";
import { KeyPointsList } from "./KeyPointsList";
import { ActionItemsList } from "./ActionItemsList";
import { ExportActions } from "./ExportActions";
import { Sparkles, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

export function SummaryView() {
  const { recordings, lastSummary, generateSummary } = useRecordings();
  const [selectedRecordingId, setSelectedRecordingId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const selectedRecording = recordings.find((r) => r.id === selectedRecordingId);

  const handleGenerateSummary = async () => {
    if (!selectedRecordingId) {
      toast.error("Please select a recording first");
      return;
    }

    try {
      setLoading(true);
      await generateSummary(selectedRecordingId);
      toast.success("Summary generated successfully");
    } catch (error) {
      toast.error("Failed to generate summary");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-1">
            <h3 className="text-lg font-semibold">AI Summary</h3>
            <p className="text-sm text-muted-foreground">
              Generate AI-powered summaries, key points, and action items
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedRecordingId} onValueChange={setSelectedRecordingId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select recording" />
              </SelectTrigger>
              <SelectContent>
                {recordings.length === 0 ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    No recordings available
                  </div>
                ) : (
                  recordings.map((recording) => (
                    <SelectItem key={recording.id} value={recording.id}>
                      {recording.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Button
              onClick={handleGenerateSummary}
              disabled={!selectedRecordingId || loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Summary
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {selectedRecording && (
        <>
          {selectedRecording.summary || lastSummary ? (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="key-points">Key Points</TabsTrigger>
                <TabsTrigger value="action-items">Action Items</TabsTrigger>
                <TabsTrigger value="transcript">Full Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-6">
                <Card className="p-6">
                  <h4 className="mb-4 text-base font-semibold">Summary</h4>
                  <p className="leading-relaxed text-muted-foreground">
                    {selectedRecording.summary || lastSummary?.summary}
                  </p>

                  {lastSummary && (
                    <div className="mt-4 grid grid-cols-3 gap-4 rounded-md border bg-muted/50 p-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="font-semibold">
                          {Math.floor(lastSummary.metadata.duration_seconds / 60)}m
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Words</p>
                        <p className="font-semibold">
                          {lastSummary.metadata.word_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Chunks</p>
                        <p className="font-semibold">
                          {lastSummary.metadata.chunk_count}
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="key-points" className="mt-6">
                <KeyPointsList
                  keyPoints={
                    selectedRecording.key_points || lastSummary?.key_points || []
                  }
                />
              </TabsContent>

              <TabsContent value="action-items" className="mt-6">
                <ActionItemsList
                  actionItems={
                    selectedRecording.action_items ||
                    lastSummary?.action_items ||
                    []
                  }
                />
              </TabsContent>

              <TabsContent value="transcript" className="mt-6">
                <Card className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-base font-semibold">Full Transcript</h4>
                    <ExportActions recordingId={selectedRecording.id} />
                  </div>
                  <ScrollArea className="h-96 rounded-md border bg-muted/50 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedRecording.enhanced_transcript ||
                        selectedRecording.raw_transcript}
                    </p>
                  </ScrollArea>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h4 className="mb-2 text-lg font-semibold">
                No Summary Yet
              </h4>
              <p className="mb-4 text-sm text-muted-foreground">
                Generate an AI summary to see key points, action items, and more.
              </p>
              <Button onClick={handleGenerateSummary} disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Summary
                  </>
                )}
              </Button>
            </Card>
          )}
        </>
      )}

      {!selectedRecording && recordings.length > 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h4 className="mb-2 text-lg font-semibold">
            Select a Recording
          </h4>
          <p className="text-sm text-muted-foreground">
            Choose a recording from the dropdown above to view or generate a summary.
          </p>
        </Card>
      )}

      {recordings.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h4 className="mb-2 text-lg font-semibold">
            No Recordings Yet
          </h4>
          <p className="text-sm text-muted-foreground">
            Create recordings from the Recording tab to generate summaries.
          </p>
        </Card>
      )}
    </div>
  );
}
