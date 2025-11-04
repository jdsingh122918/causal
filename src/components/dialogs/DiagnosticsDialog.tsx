import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";

interface LogEntry {
  timestamp: string;
  level: string;
  target: string;
  message: string;
}

interface LoggingStats {
  total_logs: number;
  log_files: number;
  total_size_bytes: number;
  oldest_log: string | null;
  newest_log: string | null;
}

interface MetricsSnapshot {
  transcription_sessions_started: number;
  transcription_sessions_completed: number;
  projects_created: number;
  recordings_saved: number;
  api_calls_made: number;
  errors_encountered: number;
  uptime_seconds: number;
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
  const [stats, setStats] = useState<LoggingStats | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadDiagnostics();
    }
  }, [open]);

  const loadDiagnostics = async () => {
    try {
      setLoading(true);
      const [logsData, statsData, metricsData] = await Promise.all([
        invoke<LogEntry[]>("get_recent_logs", { limit: 100 }),
        invoke<LoggingStats>("get_logging_stats"),
        invoke<MetricsSnapshot>("get_metrics"),
      ]);
      setLogs(logsData);
      setStats(statsData);
      setMetrics(metricsData);
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

  const handleResetMetrics = async () => {
    try {
      await invoke("reset_metrics");
      toast.success("Metrics reset");
      loadDiagnostics();
    } catch (error) {
      console.error("Failed to reset metrics:", error);
      toast.error("Failed to reset metrics");
    }
  };

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

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Diagnostics & Logs</DialogTitle>
          <DialogDescription>
            View application logs, metrics, and system information
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="logs" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {logs.length} recent log entries
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadDiagnostics}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
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

            <ScrollArea className="h-96 rounded-md border bg-background p-4">
              <div className="space-y-2 font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No logs available
                  </p>
                ) : (
                  logs.map((log, index) => (
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
                      <span className="flex-1 break-all text-foreground">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Application metrics since last reset
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetMetrics}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset Metrics
              </Button>
            </div>

            {metrics && (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Uptime</p>
                  <p className="text-2xl font-bold">
                    {formatUptime(metrics.uptime_seconds)}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    Transcription Sessions
                  </p>
                  <p className="text-2xl font-bold">
                    {metrics.transcription_sessions_started}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.transcription_sessions_completed} completed
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    Projects Created
                  </p>
                  <p className="text-2xl font-bold">
                    {metrics.projects_created}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    Recordings Saved
                  </p>
                  <p className="text-2xl font-bold">
                    {metrics.recordings_saved}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">API Calls</p>
                  <p className="text-2xl font-bold">{metrics.api_calls_made}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="text-2xl font-bold text-destructive">
                    {metrics.errors_encountered}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            {stats && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Total Logs</p>
                    <p className="text-2xl font-bold">{stats.total_logs}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Log Files</p>
                    <p className="text-2xl font-bold">{stats.log_files}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">
                      Total Size
                    </p>
                    <p className="text-2xl font-bold">
                      {formatBytes(stats.total_size_bytes)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">
                      Date Range
                    </p>
                    <p className="text-sm">
                      {stats.oldest_log && stats.newest_log ? (
                        <>
                          {new Date(stats.oldest_log).toLocaleDateString()} -{" "}
                          {new Date(stats.newest_log).toLocaleDateString()}
                        </>
                      ) : (
                        "N/A"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
