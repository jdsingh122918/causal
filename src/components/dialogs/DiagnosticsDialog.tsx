import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  ResizableDialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { invoke } from "@tauri-apps/api/core";
import { Download, RefreshCw, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";

interface LogEntry {
  timestamp: string;
  level: string;
  target: string;
  message: string;
}


interface DiagnosticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiagnosticsDialog({
  open,
  onOpenChange,
}: DiagnosticsDialogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(
    new Set(["ERROR", "WARN", "INFO", "DEBUG"])
  );
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      loadDiagnostics();
    }
  }, [open]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && open) {
      intervalRef.current = setInterval(() => {
        loadDiagnostics();
      }, 2000); // Refresh every 2 seconds
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, open]);

  const loadDiagnostics = async () => {
    try {
      setLoading(true);
      const logsData = await invoke<LogEntry[]>("get_recent_logs", { limit: 100 });
      setLogs(logsData);

      // Auto-scroll to bottom after logs update
      setTimeout(() => {
        if (scrollAreaRef.current) {
          const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollElement) {
            scrollElement.scrollTop = scrollElement.scrollHeight;
          }
        }
      }, 100);
    } catch (error) {
      console.error("Failed to load diagnostics:", error);
      toast.error("Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      const outputPath = await save({
        defaultPath: "causal-logs.txt",
        filters: [{ name: "Text", extensions: ["txt"] }],
      });

      if (outputPath) {
        await invoke("export_logs", { outputPath });
        toast.success("Logs exported successfully");
      }
    } catch (error) {
      console.error("Failed to export logs:", error);
      toast.error("Failed to export logs");
    }
  };

  const handleClearLogs = async () => {
    try {
      await invoke("clear_all_logs");
      toast.success("All logs cleared");
      loadDiagnostics();
    } catch (error) {
      console.error("Failed to clear logs:", error);
      toast.error("Failed to clear logs");
    }
  };

  const toggleLogLevel = (level: string) => {
    const newSelectedLevels = new Set(selectedLevels);
    if (newSelectedLevels.has(level)) {
      newSelectedLevels.delete(level);
    } else {
      newSelectedLevels.add(level);
    }
    setSelectedLevels(newSelectedLevels);
  };

  const filteredLogs = logs.filter(log =>
    selectedLevels.has(log.level.toUpperCase())
  );

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR":
        return "destructive";
      case "WARN":
        return "secondary";
      case "INFO":
        return "default";
      case "DEBUG":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResizableDialogContent
        initialWidth="800px"
        initialHeight="600px"
        minWidth="600px"
        minHeight="400px"
      >
        <DialogHeader>
          <DialogTitle>Diagnostics & Logs</DialogTitle>
          <DialogDescription>
            View application logs and diagnostic information
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredLogs.length} of {logs.length} log entries
              </p>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Filter className="h-4 w-4" />
                      Filter ({selectedLevels.size})
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 z-50" align="end">
                    <div className="space-y-3">
                      <h4 className="font-medium leading-none">Log Levels</h4>
                      <div className="space-y-2">
                        {["ERROR", "WARN", "INFO", "DEBUG"].map((level) => (
                          <div key={level} className="flex items-center space-x-2">
                            <Checkbox
                              id={level}
                              checked={selectedLevels.has(level)}
                              onCheckedChange={() => toggleLogLevel(level)}
                            />
                            <Label
                              htmlFor={level}
                              className="text-sm font-normal cursor-pointer flex items-center gap-2"
                            >
                              <Badge variant={getLevelColor(level)} className="text-xs">
                                {level}
                              </Badge>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                  {autoRefresh ? 'Auto' : 'Manual'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadDiagnostics}
                  disabled={loading || autoRefresh}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportLogs}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearLogs}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </Button>
              </div>
            </div>

            <ScrollArea ref={scrollAreaRef} className="flex-1 rounded-md border bg-card">
              <div className="p-4 space-y-2 font-mono text-xs min-h-full">
                {filteredLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {logs.length === 0 ? "No logs available" : "No logs match the selected filters"}
                  </p>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 border-b border-border pb-2 last:border-0"
                    >
                      <Badge variant={getLevelColor(log.level)} className="shrink-0">
                        {log.level}
                      </Badge>
                      <span className="shrink-0 text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="flex-1 break-all text-card-foreground">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
        </div>
      </ResizableDialogContent>
    </Dialog>
  );
}
