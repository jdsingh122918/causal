import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRecordings } from "@/contexts/RecordingsContext";
import { RecordingCard } from "./RecordingCard";
import { Recording } from "@/lib/types";
import { Loader2, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { RenameRecordingDialog } from "@/components/dialogs/RenameRecordingDialog";
import { toast } from "sonner";
import { ask } from "@tauri-apps/plugin-dialog";

interface RecordingHistoryProps {
  isRecording?: boolean;
}

export function RecordingHistory({ isRecording = false }: RecordingHistoryProps) {
  const { recordings, loading, deleteRecording } = useRecordings();
  const [renameRecording, setRenameRecording] = useState<Recording | null>(
    null
  );
  const [isExpanded, setIsExpanded] = useState(!isRecording);

  const handleDelete = async (recording: Recording) => {
    const confirmed = await ask(
      `Are you sure you want to delete "${recording.name}"?`,
      {
        title: "Delete Recording",
        kind: "warning",
      }
    );

    if (confirmed) {
      try {
        await deleteRecording(recording.id);
        toast.success("Recording deleted");
      } catch (error) {
        toast.error("Failed to delete recording");
        console.error(error);
      }
    }
  };

  // Get recent recordings for compact view (3 most recent)
  const recentRecordings = recordings.slice(0, 3);

  // Compact widget for when recording is active
  if (isRecording && !isExpanded) {
    return (
      <>
        <Card className="flex flex-col p-4">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-2 h-auto"
              >
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">Recent ({recentRecordings.length})</h3>
                    <span className="text-xs text-muted-foreground bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded-full">
                      Recording Active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click to expand history
                  </p>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>

            {recentRecordings.length > 0 && (
              <div className="mt-2 space-y-2">
                {recentRecordings.map((recording) => (
                  <div
                    key={recording.id}
                    className="text-xs p-2 bg-muted/50 rounded border"
                  >
                    <div className="font-medium truncate">{recording.name}</div>
                    <div className="text-muted-foreground">
                      {new Date(recording.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Collapsible>
        </Card>

        <RenameRecordingDialog
          recording={renameRecording}
          open={!!renameRecording}
          onOpenChange={(open) => !open && setRenameRecording(null)}
        />
      </>
    );
  }

  // Full collapsible view
  return (
    <>
      <Card className="flex flex-col p-6">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-0 h-auto mb-4"
            >
              <div className="text-left">
                <h3 className="text-lg font-semibold">Recording History</h3>
                <p className="text-sm text-muted-foreground">
                  {recordings.length} recording{recordings.length !== 1 ? "s" : ""}
                </p>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <ScrollArea className="h-96">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : recordings.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-3 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">No recordings yet</p>
                    <p className="text-sm text-muted-foreground">
                      Start recording to create your first transcript
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {recordings.map((recording) => (
                    <RecordingCard
                      key={recording.id}
                      recording={recording}
                      onRename={setRenameRecording}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <RenameRecordingDialog
        recording={renameRecording}
        open={!!renameRecording}
        onOpenChange={(open) => !open && setRenameRecording(null)}
      />
    </>
  );
}
