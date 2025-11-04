import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Recording } from "@/lib/types";
import { FileText, MoreVertical, Calendar, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RecordingCardProps {
  recording: Recording;
  onView: (recording: Recording) => void;
  onRename: (recording: Recording) => void;
  onDelete: (recording: Recording) => void;
}

export function RecordingCard({
  recording,
  onView,
  onRename,
  onDelete,
}: RecordingCardProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = (status: Recording["status"]) => {
    switch (status) {
      case "Completed":
        return "default";
      case "Recording":
        return "destructive";
      case "Processing":
        return "secondary";
      case "Failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Card className="group relative p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <FileText className="h-5 w-5 text-primary" />
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h4
                className="cursor-pointer font-semibold hover:underline"
                onClick={() => onView(recording)}
              >
                {recording.name}
              </h4>
              <Badge variant={getStatusColor(recording.status)}>
                {recording.status}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(recording.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(recording.metadata.duration_seconds)}
              </span>
              <span>{recording.metadata.word_count} words</span>
            </div>

            {recording.raw_transcript && (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {recording.raw_transcript}
              </p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(recording)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(recording)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(recording)}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
