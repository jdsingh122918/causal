import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  device_type: "Input" | "Output";
}

interface WordResult {
  text: string;
  start: number;
  end: number;
  confidence: number;
  is_final: boolean;
}

interface TranscriptResult {
  text: string;
  confidence: number;
  is_final: boolean;
  turn_order: number;
  end_of_turn: boolean;
  words: WordResult[];
}

interface EnhancedTranscript {
  buffer_id: number;
  raw_text: string;
  enhanced_text: string;
  processing_time_ms: number;
  model_used: string;
}

interface TranscriptSummary {
  summary: string;
  key_points: string[];
  action_items: string[];
  metadata: {
    duration_seconds: number;
    chunk_count: number;
    word_count: number;
    timestamp: string;
  };
}

// UI Elements
let deviceSelect: HTMLSelectElement;
let apiKeyInput: HTMLInputElement;
let claudeApiKeyInput: HTMLInputElement;
let startBtn: HTMLButtonElement;
let stopBtn: HTMLButtonElement;
let statusIndicator: HTMLElement;
let transcriptDisplay: HTMLElement;
let copyBtn: HTMLButtonElement;
let clearBtn: HTMLButtonElement;

// Tab elements
let tabButtons: NodeListOf<HTMLButtonElement>;
let tabContents: NodeListOf<HTMLDivElement>;

// State
let transcriptText = "";
let turns: Map<number, string> = new Map();
let latestTurnOrder = 0;
let isRecording = false; // Track if currently recording

// Enhanced transcription state
let enhancedBuffers: Map<number, string> = new Map();

// Buffering state for smoother UI updates
const DISPLAY_BUFFER_MS = 5000; // 5 second delay before showing results
let turnBuffer: Array<{ turnOrder: number; text: string; timestamp: number }> =
  [];
let displayUpdateInterval: number | null = null;

// Tab switching
function switchTab(tabName: string) {
  // Update tab buttons
  tabButtons.forEach((btn) => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update tab content
  tabContents.forEach((content) => {
    if (content.id === `${tabName}-tab`) {
      content.classList.add("active");
    } else {
      content.classList.remove("active");
    }
  });
}

async function loadAudioDevices() {
  try {
    const devices = await invoke<AudioDevice[]>("list_audio_devices");
    deviceSelect.innerHTML = "";

    if (devices.length === 0) {
      deviceSelect.innerHTML = '<option value="">No devices found</option>';
      return;
    }

    // Add input devices (microphones)
    const inputDevices = devices.filter((d) => d.device_type === "Input");
    if (inputDevices.length > 0) {
      const inputGroup = document.createElement("optgroup");
      inputGroup.label = "🎤 Input Devices (Can Record)";
      inputDevices.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.id;
        option.textContent =
          device.name + (device.is_default ? " (Default)" : "");
        inputGroup.appendChild(option);
      });
      deviceSelect.appendChild(inputGroup);
    }

    // Add output devices (speakers - NOT usable for recording without loopback software)
    const outputDevices = devices.filter((d) => d.device_type === "Output");
    if (outputDevices.length > 0) {
      const outputGroup = document.createElement("optgroup");
      outputGroup.label = "🔊 Output Devices (Requires Loopback Software)";
      outputDevices.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.id;
        option.textContent =
          device.name + (device.is_default ? " (Default)" : "");
        option.disabled = true; // Disable to prevent selection
        outputGroup.appendChild(option);
      });
      deviceSelect.appendChild(outputGroup);
    }

    // Select default input device
    const defaultDevice = devices.find(
      (d) => d.is_default && d.device_type === "Input",
    );
    if (defaultDevice) {
      deviceSelect.value = defaultDevice.id;
    }
  } catch (error) {
    console.error("Failed to load audio devices:", error);
    statusIndicator.textContent = `Error: ${error}`;
    statusIndicator.className = "status error";
  }
}

async function startTranscription() {
  const deviceId = deviceSelect.value;
  const apiKey = apiKeyInput.value.trim();
  const claudeApiKey = claudeApiKeyInput.value.trim() || null;

  if (!deviceId) {
    alert("Please select an audio device");
    return;
  }

  if (!apiKey) {
    alert("Please enter your AssemblyAI API key");
    return;
  }

  try {
    statusIndicator.textContent = "Starting...";
    statusIndicator.className = "status connecting";

    await invoke("start_transcription", { deviceId, apiKey, claudeApiKey });

    isRecording = true; // Mark as recording
    startBtn.disabled = true;
    stopBtn.disabled = false;
    deviceSelect.disabled = true;
    apiKeyInput.disabled = true;
    claudeApiKeyInput.disabled = true;

    statusIndicator.textContent = "Recording (real-time streaming)";
    statusIndicator.className = "status recording";

    // Clear previous transcripts
    transcriptText = "";
    turns.clear();
    turnBuffer = [];
    latestTurnOrder = 0;
    enhancedBuffers.clear();
    updateTranscriptDisplay();

    // Start buffered display
    startBufferedDisplay();
  } catch (error) {
    console.error("Failed to start transcription:", error);
    alert(`Failed to start transcription: ${error}`);
    statusIndicator.textContent = "Error";
    statusIndicator.className = "status error";
    isRecording = false; // Reset on error
  }
}

async function stopTranscription() {
  try {
    // CRITICAL: Set isRecording to false IMMEDIATELY to stop processing events
    isRecording = false;

    statusIndicator.textContent = "Stopping...";
    statusIndicator.className = "status connecting";

    // Stop buffered display and flush remaining turns
    stopBufferedDisplay();

    await invoke("stop_transcription");

    startBtn.disabled = false;
    stopBtn.disabled = true;
    deviceSelect.disabled = false;
    apiKeyInput.disabled = false;
    claudeApiKeyInput.disabled = false;

    // Wait a moment for any final transcripts to be processed
    statusIndicator.textContent = "Finalizing transcription...";
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(
      `Preparing to summarize: ${transcriptText.split(" ").length} words, ${latestTurnOrder} turns`,
    );

    statusIndicator.textContent = "Processing summary...";

    // Generate summary if Claude API key is provided
    const claudeApiKey = claudeApiKeyInput.value.trim();
    if (claudeApiKey && transcriptText.trim()) {
      await generateSummary(claudeApiKey);
    } else {
      statusIndicator.textContent = "Ready";
      statusIndicator.className = "status";
      if (!claudeApiKey) {
        alert(
          "Claude API key not provided. Summary not generated. Add your Claude API key to see summaries.",
        );
      }
    }
  } catch (error) {
    console.error("Failed to stop transcription:", error);
    alert(`Failed to stop transcription: ${error}`);
    statusIndicator.textContent = "Ready";
    statusIndicator.className = "status";
    isRecording = false; // Ensure it's false even on error
  }
}

async function generateSummary(claudeApiKey: string) {
  const summaryLoading = document.getElementById("summary-loading")!;
  const summaryContent = document.getElementById("summary-content")!;
  const summaryPlaceholder = document.getElementById("summary-placeholder")!;

  try {
    console.log("📋 Starting summary generation...");

    // Switch to summary tab
    switchTab("summary");

    // Show loading
    summaryLoading.style.display = "block";
    summaryContent.style.display = "none";
    summaryPlaceholder.style.display = "none";

    // Strip chunk headers from transcript
    const cleanTranscript = transcriptText.replace(/\[Chunk \d+\]/g, "").trim();

    console.log(
      `Calling backend with ${cleanTranscript.length} chars, ${latestTurnOrder} chunks`,
    );

    // Call summarization
    const summary = await invoke<TranscriptSummary>("summarize_transcription", {
      transcriptText: cleanTranscript,
      chunkCount: latestTurnOrder,
      claudeApiKey,
    });

    console.log("✅ Summary received:", summary);

    // Hide loading, show content
    summaryLoading.style.display = "none";
    summaryContent.style.display = "block";

    // Display summary
    displaySummary(summary, cleanTranscript);

    statusIndicator.textContent = "Summary generated";
    statusIndicator.className = "status";
  } catch (error) {
    console.error("Failed to generate summary:", error);
    alert(`Failed to generate summary: ${error}`);

    // Show placeholder
    summaryLoading.style.display = "none";
    summaryPlaceholder.style.display = "block";

    statusIndicator.textContent = "Ready";
    statusIndicator.className = "status";

    // Switch back to recording tab
    switchTab("recording");
  }
}

function displaySummary(summary: TranscriptSummary, fullTranscript: string) {
  // Metadata
  const durationMins = Math.round(summary.metadata.duration_seconds / 60);
  document.getElementById("summary-duration")!.textContent =
    `${durationMins} min`;
  document.getElementById("summary-chunks")!.textContent =
    summary.metadata.chunk_count.toString();
  document.getElementById("summary-words")!.textContent =
    summary.metadata.word_count.toLocaleString();

  const date = new Date(summary.metadata.timestamp);
  document.getElementById("summary-timestamp")!.textContent =
    date.toLocaleString();

  // Summary text
  document.getElementById("summary-text")!.textContent = summary.summary;

  // Key points
  const keyPointsList = document.getElementById("summary-key-points")!;
  keyPointsList.innerHTML = "";
  summary.key_points.forEach((point) => {
    const li = document.createElement("li");
    li.textContent = point;
    keyPointsList.appendChild(li);
  });

  // Action items
  const actionItemsSection = document.getElementById("action-items-section")!;
  const actionItemsList = document.getElementById("summary-action-items")!;
  actionItemsList.innerHTML = "";

  if (summary.action_items.length > 0) {
    actionItemsSection.style.display = "block";
    summary.action_items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      actionItemsList.appendChild(li);
    });
  } else {
    actionItemsSection.style.display = "none";
  }

  // Full transcript
  document.getElementById("summary-full-transcript")!.textContent =
    fullTranscript;

  // Store for export
  (window as any).currentSummary = { summary, fullTranscript };
}

function updateTranscriptDisplay() {
  // Remove placeholder if exists
  const placeholder = transcriptDisplay.querySelector(
    ".transcript-placeholder",
  );
  if (placeholder) {
    placeholder.remove();
  }

  if (turns.size === 0) {
    transcriptDisplay.innerHTML =
      '<p class="transcript-placeholder">Transcription will appear here...</p>';
    return;
  }

  // Always show enhanced version where available, fall back to raw for un-enhanced parts
  let displayText = "";

  if (enhancedBuffers.size > 0) {
    // Show enhanced version
    displayText = Array.from(enhancedBuffers.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, text]) => text.trim())
      .join(" ");
  } else {
    // Fall back to raw transcription if no enhanced buffers yet
    displayText = Array.from(turns.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, text]) => text.trim())
      .join(" ");
  }

  // Convert newlines to <br> for enhanced text which may have paragraphs
  const formattedText = displayText.replace(/\n/g, "<br><br>");

  transcriptDisplay.innerHTML = `<div class="transcript-text">${formattedText}</div>`;

  // Auto-scroll to bottom
  transcriptDisplay.scrollTop = transcriptDisplay.scrollHeight;
}

// Process buffered turns and display them after delay
function processBufferedTurns() {
  const now = Date.now();

  // Find turns that are ready to display (older than buffer time)
  const readyTurns = turnBuffer.filter(
    (item) => now - item.timestamp >= DISPLAY_BUFFER_MS,
  );

  if (readyTurns.length === 0) {
    return;
  }

  // Add ready turns to the display map
  readyTurns.forEach((item) => {
    turns.set(item.turnOrder, item.text);
  });

  // Remove processed turns from buffer
  turnBuffer = turnBuffer.filter(
    (item) => now - item.timestamp < DISPLAY_BUFFER_MS,
  );

  // Rebuild full transcript text for summary
  transcriptText = Array.from(turns.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, text]) => text)
    .join(" ");

  // Update display with smooth animation
  updateTranscriptDisplay();

  // Show buffering indicator if there are still buffered turns
  if (turnBuffer.length > 0) {
    const oldestBufferedTime = Math.min(...turnBuffer.map((t) => t.timestamp));
    const remainingMs = DISPLAY_BUFFER_MS - (now - oldestBufferedTime);
    const bufferCount = turnBuffer.length;

    if (remainingMs > 0 && bufferCount > 0) {
      statusIndicator.textContent = `Recording (${bufferCount} turn${bufferCount > 1 ? "s" : ""} buffering, ${Math.ceil(remainingMs / 1000)}s)`;
    }
  }
}

// Start the buffered display update interval
function startBufferedDisplay() {
  if (displayUpdateInterval !== null) {
    return;
  }

  // Check every 100ms for turns ready to display
  displayUpdateInterval = window.setInterval(processBufferedTurns, 100);
}

// Stop the buffered display and flush remaining turns
function stopBufferedDisplay() {
  if (displayUpdateInterval !== null) {
    window.clearInterval(displayUpdateInterval);
    displayUpdateInterval = null;
  }

  // Flush all remaining buffered turns immediately
  turnBuffer.forEach((item) => {
    turns.set(item.turnOrder, item.text);
  });
  turnBuffer = [];

  // Final update
  transcriptText = Array.from(turns.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, text]) => text)
    .join(" ");

  updateTranscriptDisplay();
}

function copyTranscript() {
  if (!transcriptText) {
    alert("No transcript to copy");
    return;
  }

  navigator.clipboard.writeText(transcriptText).then(
    () => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 2000);
    },
    (err) => {
      console.error("Failed to copy:", err);
      alert("Failed to copy transcript");
    },
  );
}

function clearTranscript() {
  transcriptText = "";
  turns.clear();
  turnBuffer = [];
  latestTurnOrder = 0;
  enhancedBuffers.clear();
  updateTranscriptDisplay();
}

// Export functions
function exportAsText() {
  const data = (window as any).currentSummary;
  if (!data) return;

  const content = `TRANSCRIPT SUMMARY
Generated: ${new Date(data.summary.metadata.timestamp).toLocaleString()}
Duration: ${Math.round(data.summary.metadata.duration_seconds / 60)} minutes
Chunks: ${data.summary.metadata.chunk_count}
Words: ${data.summary.metadata.word_count}

SUMMARY
${data.summary.summary}

KEY POINTS
${data.summary.key_points.map((p: string) => `- ${p}`).join("\n")}

${
  data.summary.action_items.length > 0
    ? `ACTION ITEMS\n${data.summary.action_items.map((i: string) => `- ${i}`).join("\n")}\n\n`
    : ""
}FULL TRANSCRIPT
${data.fullTranscript}
`;

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transcript-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAsJSON() {
  const data = (window as any).currentSummary;
  if (!data) return;

  const content = JSON.stringify(
    {
      summary: data.summary,
      full_transcript: data.fullTranscript,
    },
    null,
    2,
  );

  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transcript-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function copySummary() {
  const data = (window as any).currentSummary;
  if (!data) return;

  const text = `${data.summary.summary}\n\nKey Points:\n${data.summary.key_points.map((p: string) => `- ${p}`).join("\n")}`;

  navigator.clipboard.writeText(text).then(
    () => {
      const btn = document.getElementById("copy-summary-btn")!;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = "Copy Summary";
      }, 2000);
    },
    (err) => {
      console.error("Failed to copy:", err);
      alert("Failed to copy summary");
    },
  );
}

function newRecording() {
  switchTab("recording");
  clearTranscript();
  (window as any).currentSummary = null;

  // Reset summary tab
  document.getElementById("summary-loading")!.style.display = "none";
  document.getElementById("summary-content")!.style.display = "none";
  document.getElementById("summary-placeholder")!.style.display = "block";
}

window.addEventListener("DOMContentLoaded", async () => {
  // Get DOM elements
  deviceSelect = document.querySelector("#device-select")!;
  apiKeyInput = document.querySelector("#api-key-input")!;
  claudeApiKeyInput = document.querySelector("#claude-api-key-input")!;
  startBtn = document.querySelector("#start-btn")!;
  stopBtn = document.querySelector("#stop-btn")!;
  statusIndicator = document.querySelector("#status-indicator")!;
  transcriptDisplay = document.querySelector("#transcript-display")!;
  copyBtn = document.querySelector("#copy-btn")!;
  clearBtn = document.querySelector("#clear-btn")!;

  tabButtons = document.querySelectorAll(".tab-button");
  tabContents = document.querySelectorAll(".tab-content");

  // Load audio devices
  await loadAudioDevices();

  // Add event listeners for tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab!;
      switchTab(tabName);
    });
  });

  // Add event listeners
  startBtn.addEventListener("click", startTranscription);
  stopBtn.addEventListener("click", stopTranscription);
  copyBtn.addEventListener("click", copyTranscript);
  clearBtn.addEventListener("click", clearTranscript);

  // Summary actions
  document
    .getElementById("export-txt-btn")!
    .addEventListener("click", exportAsText);
  document
    .getElementById("export-json-btn")!
    .addEventListener("click", exportAsJSON);
  document
    .getElementById("copy-summary-btn")!
    .addEventListener("click", copySummary);
  document
    .getElementById("new-recording-btn")!
    .addEventListener("click", newRecording);

  // Listen for transcript events (turn-based from Universal Streaming)
  await listen<TranscriptResult>("transcript", (event) => {
    // CRITICAL FIX: Ignore events if not recording (prevents UI updates after stop)
    if (!isRecording) {
      return;
    }

    const result = event.payload;

    latestTurnOrder = Math.max(latestTurnOrder, result.turn_order);

    // CRITICAL FIX: Replace existing turn in buffer instead of pushing duplicate
    // AssemblyAI sends multiple partial updates for the same turn_order
    const existingIndex = turnBuffer.findIndex(
      (item) => item.turnOrder === result.turn_order,
    );

    if (existingIndex >= 0) {
      // Update existing turn with new text (keep original timestamp for buffering)
      turnBuffer[existingIndex].text = result.text;
    } else {
      // Add new turn to buffer with timestamp (will be displayed after delay)
      turnBuffer.push({
        turnOrder: result.turn_order,
        text: result.text,
        timestamp: Date.now(),
      });
    }

    // Update status to show real-time progress
    const turnLabel = result.end_of_turn ? "✓" : "...";
    statusIndicator.textContent = `Recording (Turn ${result.turn_order} ${turnLabel} • ${(result.confidence * 100).toFixed(0)}% confident)`;
  });

  // Listen for enhanced transcripts
  await listen<EnhancedTranscript>("enhanced_transcript", (event) => {
    // CRITICAL FIX: Ignore events if not recording (prevents UI updates after stop)
    if (!isRecording) {
      return;
    }

    const enhanced = event.payload;

    console.log(
      `Enhanced buffer ${enhanced.buffer_id} in ${enhanced.processing_time_ms}ms`,
    );

    // Store enhanced text by buffer_id
    enhancedBuffers.set(enhanced.buffer_id, enhanced.enhanced_text);

    // Update display with enhanced text
    updateTranscriptDisplay();

    // Update status to show enhancement is working
    statusIndicator.textContent = `Recording (${enhancedBuffers.size} buffers enhanced)`;
  });

  // Listen for transcription errors
  await listen<string>("transcription_error", (event) => {
    const error = event.payload;
    console.error("Transcription error:", error);

    // Stop recording immediately
    isRecording = false;

    // Update UI to show error
    statusIndicator.textContent = "Error";
    statusIndicator.className = "status error";

    // Reset buttons
    startBtn.disabled = false;
    stopBtn.disabled = true;
    deviceSelect.disabled = false;
    apiKeyInput.disabled = false;
    claudeApiKeyInput.disabled = false;

    // Show error to user
    alert(`Transcription error: ${error}`);
  });

  // Load API keys from localStorage
  const savedApiKey = localStorage.getItem("assemblyai_api_key");
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
  }

  const savedClaudeKey = localStorage.getItem("claude_api_key");
  if (savedClaudeKey) {
    claudeApiKeyInput.value = savedClaudeKey;
  }

  // Save API keys on change
  apiKeyInput.addEventListener("change", () => {
    if (apiKeyInput.value.trim()) {
      localStorage.setItem("assemblyai_api_key", apiKeyInput.value.trim());
    }
  });

  claudeApiKeyInput.addEventListener("change", () => {
    if (claudeApiKeyInput.value.trim()) {
      localStorage.setItem("claude_api_key", claudeApiKeyInput.value.trim());
    }
  });
});
