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
import { useProjects } from "@/contexts/ProjectsContext";
import { Project } from "@/lib/types";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface DeleteProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
}: DeleteProjectDialogProps) {
  const [confirmationName, setConfirmationName] = useState("");
  const [loading, setLoading] = useState(false);
  const { deleteProject } = useProjects();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!project) return;

    if (confirmationName !== project.name) {
      toast.error("Project name doesn't match. Please type the exact project name to confirm deletion.");
      return;
    }

    try {
      setLoading(true);
      await deleteProject(project.id);
      toast.success(`Project "${project.name}" deleted successfully`);
      onOpenChange(false);
      setConfirmationName("");
    } catch (error) {
      toast.error("Failed to delete project");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmationName("");
    }
    onOpenChange(newOpen);
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the project
              "{project.name}" and all of its recordings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4">
              <h4 className="text-sm font-medium text-destructive mb-2">Warning</h4>
              <p className="text-sm text-muted-foreground">
                Deleting this project will also permanently delete:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• All recordings in this project</li>
                <li>• All transcripts and summaries</li>
                <li>• Any exported files will remain but won't be accessible through the app</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmation-name">
                Type "<strong>{project.name}</strong>" to confirm deletion
              </Label>
              <Input
                id="confirmation-name"
                placeholder={`Type "${project.name}" here`}
                value={confirmationName}
                onChange={(e) => setConfirmationName(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={loading || confirmationName !== project.name}
            >
              {loading ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}