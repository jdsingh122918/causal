import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Recording } from "@/lib/types";
import { FileText, MoreVertical, Calendar, Clock, CheckCircle, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RecordingCardProps {
  recording: Recording;
  onRename: (recording: Recording) => void;
  onDelete: (recording: Recording) => void;
}

export function RecordingCard({
  recording,
  onRename,
  onDelete,
}: RecordingCardProps) {
  const navigate = useNavigate();
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

  const getSummaryIndicator = () => {
    if (recording.summary) {
      return {
        icon: <CheckCircle className="h-3 w-3 text-green-500" />,
        text: "Summary available",
        color: "text-green-600"
      };
    }
    // Note: We'll add summary_status later for generating state
    return {
      icon: <AlertCircle className="h-3 w-3 text-muted-foreground" />,
      text: "No summary",
      color: "text-muted-foreground"
    };
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the dropdown menu
    if ((e.target as HTMLElement).closest('[role="button"]')) {
      return;
    }
    navigate(`/recordings/${recording.id}`);
  };

  const summaryIndicator = getSummaryIndicator();

  return (
    <Card
      className="group relative p-4 transition-all hover:shadow-lg cursor-pointer border-border/50 hover:border-border"
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <FileText className="h-5 w-5 text-primary" />
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold group-hover:text-primary transition-colors">
                {recording.name}
              </h4>
              <Badge variant={getStatusColor(recording.status)}>
                {recording.status}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(recording.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(recording.metadata.duration_seconds)}
              </span>
              <span className="flex items-center gap-1" title={summaryIndicator.text}>
                {summaryIndicator.icon}
                <span className={summaryIndicator.color}>Summary</span>
              </span>
            </div>

            {/* Show summary preview if available, otherwise show transcript preview */}
            {recording.summary ? (
              <p className="line-clamp-2 text-sm text-foreground/80">
                <span className="font-medium text-green-600">Summary:</span> {recording.summary}
              </p>
            ) : recording.raw_transcript ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {recording.raw_transcript}
              </p>
            ) : (
              <p className="line-clamp-2 text-sm text-muted-foreground italic">
                No content available
              </p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
