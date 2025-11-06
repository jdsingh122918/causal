import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DebugData {
  platform: {
    os: string;
    arch: string;
    family: string;
  };
  application: {
    name: string;
    version: string;
  };
  log_directory: string;
  environment: Record<string, string | null>;
  timestamp: string;
}

export function DebugInfo() {
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const collectDebugInfo = async () => {
    console.log("🔍 Collecting debug information...");
    setLoading(true);

    try {
      // Get backend debug info
      const backendInfo = await invoke<DebugData>("get_debug_info");
      setDebugData(backendInfo);

      // Get recent logs
      const recentLogs = await invoke<any[]>("get_recent_logs", { limit: 50 });
      const logMessages = recentLogs.map(log =>
        `[${log.timestamp}] ${log.level}: ${log.message}`
      );
      setLogs(logMessages);

      console.log("✅ Debug information collected:", {
        backendInfo,
        logCount: recentLogs.length
      });
    } catch (error) {
      console.error("❌ Failed to collect debug info:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportDebugInfo = () => {
    const frontendInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    const fullDebugInfo = {
      frontend: frontendInfo,
      backend: debugData,
      logs: logs,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(fullDebugInfo, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `causal-debug-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("📁 Debug info exported to file");
  };

  useEffect(() => {
    console.log("🔧 DebugInfo component mounted");
    collectDebugInfo();
  }, []);

  if (!debugData) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p>Loading debug information...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Debug Information</h3>
          <div className="space-x-2">
            <Button onClick={collectDebugInfo} disabled={loading} size="sm">
              {loading ? "Collecting..." : "Refresh"}
            </Button>
            <Button onClick={exportDebugInfo} variant="outline" size="sm">
              Export Debug File
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Platform</h4>
            <div className="space-y-1 text-sm">
              <p><strong>OS:</strong> {debugData.platform.os}</p>
              <p><strong>Architecture:</strong> {debugData.platform.arch}</p>
              <p><strong>Family:</strong> {debugData.platform.family}</p>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Application</h4>
            <div className="space-y-1 text-sm">
              <p><strong>Name:</strong> {debugData.application.name}</p>
              <p><strong>Version:</strong> {debugData.application.version}</p>
            </div>
          </div>

          <div className="md:col-span-2">
            <h4 className="font-medium mb-2">Log Directory</h4>
            <p className="text-sm font-mono bg-muted p-2 rounded">
              {debugData.log_directory}
            </p>
          </div>

          <div className="md:col-span-2">
            <h4 className="font-medium mb-2">Environment</h4>
            <div className="space-y-1 text-sm">
              {Object.entries(debugData.environment).map(([key, value]) => (
                <p key={key}>
                  <strong>{key}:</strong> {value || "Not set"}
                </p>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <h4 className="font-medium mb-2">Frontend Information</h4>
            <div className="space-y-1 text-sm">
              <p><strong>User Agent:</strong> {navigator.userAgent}</p>
              <p><strong>Window Size:</strong> {window.innerWidth}x{window.innerHeight}</p>
              <p><strong>Device Pixel Ratio:</strong> {window.devicePixelRatio}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Logs ({logs.length})</h3>
        <ScrollArea className="h-64">
          <div className="font-mono text-xs space-y-1">
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div
                  key={index}
                  className="p-1 rounded bg-muted/50 whitespace-pre-wrap break-all"
                >
                  {log}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No logs available</p>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}