import { useState, useEffect } from "react";
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
import { Recording } from "@/lib/types";
import { toast } from "sonner";

interface RenameRecordingDialogProps {
  recording: Recording | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameRecordingDialog({
  recording,
  open,
  onOpenChange,
}: RenameRecordingDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { renameRecording } = useRecordings();

  useEffect(() => {
    if (recording && open) {
      setName(recording.name);
    }
  }, [recording, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recording) return;

    if (!name.trim()) {
      toast.error("Recording name is required");
      return;
    }

    if (name.trim() === recording.name) {
      onOpenChange(false);
      return;
    }

    try {
      setLoading(true);
      await renameRecording(recording.id, name.trim());
      toast.success("Recording renamed successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to rename recording");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!recording) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Recording</DialogTitle>
            <DialogDescription>
              Enter a new name for this recording.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Recording Name</Label>
              <Input
                id="new-name"
                placeholder="Enter new name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
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
              {loading ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
