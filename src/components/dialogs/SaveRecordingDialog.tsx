import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRecordings } from "@/contexts/RecordingsContext";
import { useTranscription } from "@/contexts/TranscriptionContext";
import { toast } from "sonner";

interface SaveRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveRecordingDialog({
  open,
  onOpenChange,
}: SaveRecordingDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { saveRecording } = useRecordings();
  const { state, clearTranscript } = useTranscription();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Recording name is required");
      return;
    }

    if (!state.transcriptText) {
      toast.error("No transcript to save");
      return;
    }

    try {
      setLoading(true);
      await saveRecording(name.trim(), state.transcriptText);
      toast.success("Recording saved successfully");
      setName("");
      clearTranscript();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save recording");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save Recording</DialogTitle>
            <DialogDescription>
              Give your recording a name to save it to the project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recording-name">Recording Name</Label>
              <Input
                id="recording-name"
                placeholder="e.g., Meeting Notes - Nov 4"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="rounded-md border bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                {state.transcriptText.split(" ").length} words •{" "}
                {state.turns.size} turns
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Recording"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
