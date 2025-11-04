import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Recording } from "@/lib/types";
import { Calendar, Clock, FileText, Download } from "lucide-react";
import { useRecordings } from "@/contexts/RecordingsContext";
import { toast } from "sonner";

interface RecordingDetailDialogProps {
  recording: Recording | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordingDetailDialog({
  recording,
  open,
  onOpenChange,
}: RecordingDetailDialogProps) {
  const { exportRecording } = useRecordings();

  if (!recording) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const handleExport = async (format: "txt" | "json") => {
    try {
      await exportRecording(recording.id, format);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export recording");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {recording.name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(recording.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(recording.metadata.duration_seconds)}
            </span>
            <Badge variant="outline">{recording.status}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-4 gap-4 rounded-md border bg-muted/50 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Words</p>
              <p className="text-lg font-semibold">
                {recording.metadata.word_count}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Turns</p>
              <p className="text-lg font-semibold">
                {recording.metadata.turn_count}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Chunks</p>
              <p className="text-lg font-semibold">
                {recording.metadata.chunk_count}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-lg font-semibold">
                {Math.round(recording.metadata.average_confidence * 100)}%
              </p>
            </div>
          </div>

          {/* Tabs for different views */}
          <Tabs defaultValue="raw" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="raw">Raw Transcript</TabsTrigger>
              <TabsTrigger value="enhanced">Enhanced</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="raw" className="mt-4">
              <ScrollArea className="h-96 rounded-md border bg-background p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {recording.raw_transcript}
                </p>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="enhanced" className="mt-4">
              <ScrollArea className="h-96 rounded-md border bg-background p-4">
                {recording.enhanced_transcript ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {recording.enhanced_transcript}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No enhanced transcript available
                  </p>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="summary" className="mt-4">
              <ScrollArea className="h-96 space-y-4">
                {recording.summary ? (
                  <>
                    <div className="rounded-md border bg-background p-4">
                      <h4 className="mb-2 font-semibold">Summary</h4>
                      <p className="text-sm leading-relaxed">
                        {recording.summary}
                      </p>
                    </div>

                    {recording.key_points.length > 0 && (
                      <div className="rounded-md border bg-background p-4">
                        <h4 className="mb-2 font-semibold">Key Points</h4>
                        <ul className="list-inside list-disc space-y-1 text-sm">
                          {recording.key_points.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {recording.action_items.length > 0 && (
                      <div className="rounded-md border bg-background p-4">
                        <h4 className="mb-2 font-semibold">Action Items</h4>
                        <ul className="list-inside list-disc space-y-1 text-sm">
                          {recording.action_items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No summary available. Generate one from the Summary tab.
                  </p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Export Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("txt")}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export TXT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("json")}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
