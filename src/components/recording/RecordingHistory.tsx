import { useState, lazy, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRecordings } from "@/contexts/RecordingsContext";
import { RecordingCard } from "./RecordingCard";
import { Recording } from "@/lib/types";
import { Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { ask } from "@tauri-apps/plugin-dialog";

// Lazy load dialog that's only shown conditionally
const RenameRecordingDialog = lazy(() => import("@/components/dialogs/RenameRecordingDialog"));

export function RecordingHistory() {
  const { recordings, loading, deleteRecording } = useRecordings();
  const [renameRecording, setRenameRecording] = useState<Recording | null>(
    null
  );

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

  return (
    <>
      <Card className="flex flex-col p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Recording History</h3>
            <p className="text-sm text-muted-foreground">
              {recordings.length} recording{recordings.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

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
      </Card>

      {renameRecording && (
        <Suspense fallback={null}>
          <RenameRecordingDialog
            recording={renameRecording}
            open={!!renameRecording}
            onOpenChange={(open) => !open && setRenameRecording(null)}
          />
        </Suspense>
      )}
    </>
  );
}
