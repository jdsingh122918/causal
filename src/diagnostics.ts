import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  fields?: string;
}

interface LoggingStats {
  log_directory: string;
  current_log_file: string;
  total_size_bytes: number;
  file_count: number;
  oldest_log_date?: string;
}

// Initialize diagnostics tab
export function initDiagnostics() {
  const refreshLogsBtn = document.getElementById(
    "refresh-logs-btn",
  ) as HTMLButtonElement;
  const exportLogsBtn = document.getElementById(
    "export-logs-btn",
  ) as HTMLButtonElement;
  const clearOldLogsBtn = document.getElementById(
    "clear-old-logs-btn",
  ) as HTMLButtonElement;
  const logLimitSelect = document.getElementById(
    "log-limit-select",
  ) as HTMLSelectElement;
  const logLevelFilter = document.getElementById(
    "log-level-filter",
  ) as HTMLSelectElement;

  // Event listeners
  refreshLogsBtn?.addEventListener("click", loadLogs);
  exportLogsBtn?.addEventListener("click", exportLogs);
  clearOldLogsBtn?.addEventListener("click", async () => {
    if (confirm("Clear old log files? The current log will be preserved.")) {
      try {
        const result = await invoke<string>("clear_old_logs");
        alert(result);
        await loadLoggingStats();
      } catch (error) {
        console.error("Failed to clear logs:", error);
        alert(`Failed to clear logs: ${error}`);
      }
    }
  });

  logLimitSelect?.addEventListener("change", loadLogs);
  logLevelFilter?.addEventListener("change", filterLogs);

  // Initial load
  loadLogs();
  loadLoggingStats();
}

// Load and display logs
let allLogs: LogEntry[] = [];

export async function loadLogs() {
  try {
    const limitSelect = document.getElementById(
      "log-limit-select",
    ) as HTMLSelectElement;
    const limit = parseInt(limitSelect?.value || "100");

    allLogs = await invoke<LogEntry[]>("get_recent_logs", { limit });
    filterLogs();
  } catch (error) {
    console.error("Failed to load logs:", error);
    const logEntries = document.getElementById("log-entries");
    if (logEntries) {
      logEntries.innerHTML = `<div class="log-entry log-error">Failed to load logs: ${error}</div>`;
    }
  }
}

function filterLogs() {
  const levelFilter = document.getElementById(
    "log-level-filter",
  ) as HTMLSelectElement;
  const selectedLevel = levelFilter?.value || "ALL";

  const levelPriority: { [key: string]: number } = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
  };

  let filteredLogs = allLogs;

  if (selectedLevel !== "ALL") {
    const minPriority = levelPriority[selectedLevel] || 0;
    filteredLogs = allLogs.filter((log) => {
      const logLevel = log.level.toUpperCase();
      const logPriority = levelPriority[logLevel] || 0;
      return logPriority >= minPriority;
    });
  }

  displayLogs(filteredLogs);
}

function displayLogs(logs: LogEntry[]) {
  const logEntries = document.getElementById("log-entries");
  if (!logEntries) return;

  if (logs.length === 0) {
    logEntries.innerHTML = '<div class="log-entry">No log entries found.</div>';
    return;
  }

  logEntries.innerHTML = logs
    .reverse() // Show newest first
    .map((log) => {
      const levelClass = `log-${log.level.toLowerCase()}`;
      return `
        <div class="log-entry ${levelClass}">
          <span class="log-timestamp">${log.timestamp}</span>
          <span class="log-level">${log.level}</span>
          <span class="log-message">${escapeHtml(log.message)}</span>
        </div>
      `;
    })
    .join("");
}

// Load and display logging stats
export async function loadLoggingStats() {
  try {
    const stats = await invoke<LoggingStats>("get_logging_stats");

    setText("log-directory", stats.log_directory);
    setText("log-total-size", formatBytes(stats.total_size_bytes));
    setText("log-file-count", stats.file_count);
  } catch (error) {
    console.error("Failed to load logging stats:", error);
  }
}

// Export logs
async function exportLogs() {
  try {
    const filePath = await save({
      defaultPath: `causal-logs-${new Date().toISOString().split("T")[0]}.log`,
      filters: [
        {
          name: "Log Files",
          extensions: ["log", "txt"],
        },
      ],
    });

    if (filePath) {
      const result = await invoke<string>("export_logs", {
        outputPath: filePath,
      });
      alert(result);
    }
  } catch (error) {
    console.error("Failed to export logs:", error);
    alert(`Failed to export logs: ${error}`);
  }
}

// Utility functions
function setText(id: string, value: string | number) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = String(value);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
