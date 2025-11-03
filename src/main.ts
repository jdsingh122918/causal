import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { initDiagnostics } from "./diagnostics";

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

// Project and Recording interfaces
interface Project {
  id: string;
  name: string;
  description: string;
  created_at: number; // SystemTime as Unix timestamp
  updated_at: number;
}

interface RecordingMetadata {
  duration_seconds: number;
  word_count: number;
  chunk_count: number;
  turn_count: number;
  average_confidence: number;
}

interface Recording {
  id: string;
  project_id: string;
  name: string;
  raw_transcript: string;
  enhanced_transcript: string;
  summary: string | null;
  key_points: string[];
  action_items: string[];
  metadata: RecordingMetadata;
  status: "Recording" | "Processing" | "Completed" | "Failed";
  created_at: number;
}

interface CreateProjectRequest {
  name: string;
  description: string;
}

// Refinement configuration
type RefinementMode = "disabled" | "realtime" | "chunked";

interface RefinementConfig {
  mode: RefinementMode;
  chunk_duration_secs: number;
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

// Refinement settings UI
let refinementModeRadios: NodeListOf<HTMLInputElement>;
let chunkDurationInput: HTMLInputElement;
let chunkDurationGroup: HTMLElement;

// Tab elements
let tabButtons: NodeListOf<HTMLButtonElement>;
let tabContents: NodeListOf<HTMLDivElement>;

// Multi-project UI elements
let projectsList: HTMLElement;
let newProjectBtn: HTMLButtonElement;
let currentProjectIndicator: HTMLElement;
let recordingsList: HTMLElement;
let recordingsEmptyState: HTMLElement;
let recordingCount: HTMLElement;
let newProjectDialog: HTMLElement;
let saveRecordingDialog: HTMLElement;
let settingsDialog: HTMLElement;
let recordingDetailView: HTMLElement;

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

// Project and Recording state
let projects: Project[] = [];
let currentProject: Project | null = null;
let recordings: Recording[] = [];
let currentRecording: Recording | null = null;
let lastSummary: TranscriptSummary | null = null;

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

    // Only show input devices (microphones)
    // Output devices (speakers) are filtered out since they can't be used for recording
    // Note: Loopback software like BlackHole appears as an Input device
    const inputDevices = devices.filter((d) => d.device_type === "Input");

    inputDevices.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.id;
      option.textContent =
        device.name + (device.is_default ? " (Default)" : "");
      deviceSelect.appendChild(option);
    });

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

  // Get current project ID (null if no project selected)
  const projectId = currentProject ? currentProject.id : null;

  // Get refinement config
  const refinementMode =
    ((
      document.querySelector(
        'input[name="refinement-mode"]:checked',
      ) as HTMLInputElement
    )?.value as RefinementMode) || "chunked";

  const refinementConfig: RefinementConfig = {
    mode: refinementMode,
    chunk_duration_secs: parseInt(chunkDurationInput.value) || 10,
  };

  try {
    statusIndicator.textContent = "Starting...";
    statusIndicator.className = "status connecting";

    await invoke("start_transcription", {
      deviceId,
      apiKey,
      claudeApiKey,
      projectId,
      refinementConfig,
    });

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
        console.log(
          "Claude API key not provided. Skipping summary generation.",
        );
      }
    }

    // Show save recording dialog if we have a project selected and content
    if (currentProject && transcriptText.trim()) {
      showSaveRecordingDialog();
    } else if (!currentProject) {
      const shouldCreateProject = confirm(
        "No project selected. Would you like to create a project to save this recording?",
      );
      if (shouldCreateProject) {
        showNewProjectDialog();
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

    // Show placeholder
    summaryLoading.style.display = "none";
    summaryPlaceholder.style.display = "block";

    statusIndicator.textContent = "Ready";
    statusIndicator.className = "status";

    // Switch back to recording tab
    switchTab("recording");

    // Show user-friendly error with retry instructions
    const errorMsg = String(error);
    if (errorMsg.includes("502") || errorMsg.includes("Bad Gateway")) {
      alert(
        `Summary generation failed due to a temporary server error (502 Bad Gateway).\n\n` +
          `Don't worry - your recording will be saved! You can generate the summary later by:\n` +
          `1. Saving the recording when prompted\n` +
          `2. Opening it from the Recording History\n` +
          `3. Clicking "Generate Summary" button\n\n` +
          `This often happens when Claude's servers are busy. Please try again in a few moments.`,
      );
    } else {
      alert(
        `Failed to generate summary: ${error}\n\n` +
          `Your recording will still be saved. You can generate the summary later from the Recording History.`,
      );
    }
  }
}

function displaySummary(summary: TranscriptSummary, fullTranscript: string) {
  // Store summary for later use
  lastSummary = summary;

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

// ===== PROJECT MANAGEMENT FUNCTIONS =====

async function loadProjects() {
  try {
    projects = await invoke<Project[]>("list_projects");
    renderProjects();

    // If we have a current project, reload its recordings
    if (currentProject) {
      await loadRecordings(currentProject.id);
    } else if (projects.length > 0) {
      // Auto-select the first project if none is selected
      await selectProject(projects[0]);
    }
  } catch (error) {
    console.error("Failed to load projects:", error);
    alert(`Failed to load projects: ${error}`);
  }
}

function renderProjects() {
  if (projects.length === 0) {
    projectsList.innerHTML =
      '<div class="empty-state"><p>No projects yet.<br>Click + to create one!</p></div>';
    return;
  }

  projectsList.innerHTML = "";
  projects.forEach((project) => {
    const projectEl = document.createElement("div");
    projectEl.className = "project-item";
    if (currentProject && currentProject.id === project.id) {
      projectEl.classList.add("active");
    }
    projectEl.dataset.projectId = project.id;

    projectEl.innerHTML = `
      <div class="project-icon">📁</div>
      <div class="project-info">
        <div class="project-name">${escapeHtml(project.name)}</div>
        <div class="project-meta">${project.description || "No description"}</div>
      </div>
      <button class="project-delete-btn" title="Delete project" data-project-id="${project.id}">
        🗑️
      </button>
    `;

    // Add delete button handler first
    const deleteBtn = projectEl.querySelector(
      ".project-delete-btn",
    ) as HTMLElement;
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        confirmDeleteProject(project);
      });
    }

    // Add project selection handler
    projectEl.addEventListener("click", (e) => {
      // Don't select project if clicking delete button or its children
      const target = e.target as HTMLElement;
      if (!target.closest(".project-delete-btn")) {
        selectProject(project);
      }
    });

    projectsList.appendChild(projectEl);
  });
}

async function selectProject(project: Project) {
  currentProject = project;

  // Update current project in backend
  await invoke("set_current_project", { projectId: project.id });

  // Update UI
  renderProjects();
  updateCurrentProjectIndicator();

  // Load recordings for this project
  await loadRecordings(project.id);
}

function updateCurrentProjectIndicator() {
  const label = currentProjectIndicator.querySelector(".project-label")!;
  if (currentProject) {
    label.textContent = `Project: ${currentProject.name}`;
  } else {
    label.textContent = "No project selected";
  }
}

async function createProject(name: string, description: string) {
  try {
    const request: CreateProjectRequest = { name, description };
    const project = await invoke<Project>("create_project", { request });

    await loadProjects();
    await selectProject(project);

    return project;
  } catch (error) {
    console.error("Failed to create project:", error);
    throw error;
  }
}

async function confirmDeleteProject(project: Project) {
  const recordingCount = recordings.length;
  const message =
    recordingCount > 0
      ? `This will permanently delete:\n- The project\n- ${recordingCount} recording${recordingCount !== 1 ? "s" : ""}\n\nThis action cannot be undone.`
      : `This action cannot be undone.`;

  const confirmed = await ask(message, {
    title: `Delete "${project.name}"?`,
    kind: "warning",
    okLabel: "Delete",
    cancelLabel: "Cancel",
  });

  if (confirmed) {
    deleteProject(project.id);
  }
}

async function deleteProject(projectId: string) {
  try {
    await invoke("delete_project", { id: projectId });

    // If the deleted project was the current project, clear it
    if (currentProject && currentProject.id === projectId) {
      currentProject = null;
      recordings = [];
      updateCurrentProjectIndicator();
      renderRecordings();
    }

    // Reload projects and auto-select first one if available
    await loadProjects();
  } catch (error) {
    console.error("Failed to delete project:", error);
    alert(`Failed to delete project: ${error}`);
  }
}

// ===== RECORDING MANAGEMENT FUNCTIONS =====

async function loadRecordings(projectId: string) {
  try {
    recordings = await invoke<Recording[]>("list_recordings", { projectId });
    renderRecordings();
  } catch (error) {
    console.error("Failed to load recordings:", error);
    alert(`Failed to load recordings: ${error}`);
  }
}

function renderRecordings() {
  recordingCount.textContent = `${recordings.length} recording${recordings.length !== 1 ? "s" : ""}`;

  if (recordings.length === 0) {
    recordingsEmptyState.style.display = "block";
    recordingsList.innerHTML = "";
    return;
  }

  recordingsEmptyState.style.display = "none";
  recordingsList.innerHTML = "";

  // Sort by created_at descending (newest first)
  const sortedRecordings = [...recordings].sort(
    (a, b) => b.created_at - a.created_at,
  );

  sortedRecordings.forEach((recording) => {
    const card = document.createElement("div");
    card.className = "recording-card";
    card.dataset.recordingId = recording.id;

    const createdDate = new Date(recording.created_at * 1000); // Convert from Unix timestamp
    const formattedDate = createdDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    card.innerHTML = `
      <div class="recording-header">
        <h4 class="recording-name">${escapeHtml(recording.name)}</h4>
        <span class="recording-status status-${recording.status.toLowerCase()}">${recording.status}</span>
      </div>
      <div class="recording-meta">
        <span class="meta-item">
          <span class="meta-icon">⏱️</span>
          ${Math.round(recording.metadata.duration_seconds)}s
        </span>
        <span class="meta-item">
          <span class="meta-icon">📝</span>
          ${recording.metadata.word_count} words
        </span>
        <span class="meta-item">
          <span class="meta-icon">📅</span>
          ${formattedDate}
        </span>
      </div>
      <div class="recording-actions">
        <button class="btn-small view-btn" data-recording-id="${recording.id}">View</button>
        <button class="btn-small delete-btn" data-recording-id="${recording.id}">Delete</button>
      </div>
    `;

    // Add event listeners
    card.querySelector(".view-btn")!.addEventListener("click", (e) => {
      e.stopPropagation();
      viewRecording(recording.id);
    });

    card.querySelector(".delete-btn")!.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteRecording(recording.id);
    });

    card.addEventListener("click", () => viewRecording(recording.id));

    recordingsList.appendChild(card);
  });
}

async function viewRecording(recordingId: string) {
  try {
    const recording = await invoke<Recording>("get_recording", {
      id: recordingId,
    });
    showRecordingDetail(recording);
  } catch (error) {
    console.error("Failed to load recording:", error);
    alert(`Failed to load recording: ${error}`);
  }
}

function showRecordingDetail(recording: Recording) {
  currentRecording = recording;

  // Update header
  document.getElementById("detail-recording-name")!.textContent =
    recording.name;

  // Update metadata
  const createdDate = new Date(recording.created_at * 1000);
  document.getElementById("detail-metadata-duration")!.textContent =
    `${Math.round(recording.metadata.duration_seconds)}s`;
  document.getElementById("detail-metadata-words")!.textContent =
    recording.metadata.word_count.toString();
  document.getElementById("detail-metadata-turns")!.textContent =
    recording.metadata.turn_count.toString();
  document.getElementById("detail-metadata-created")!.textContent =
    createdDate.toLocaleString();

  // Update transcript
  document.getElementById("detail-transcript")!.textContent =
    recording.enhanced_transcript;

  // Show/hide Generate Summary button based on whether summary exists
  const generateSummaryBtn = document.getElementById(
    "detail-generate-summary-btn",
  )! as HTMLButtonElement;
  if (!recording.summary || recording.summary.trim() === "") {
    generateSummaryBtn.style.display = "inline-block";
  } else {
    generateSummaryBtn.style.display = "none";
  }

  // Update summary if available
  const summarySection = document.getElementById("detail-summary-section")!;
  if (recording.summary) {
    summarySection.style.display = "block";
    document.getElementById("detail-summary")!.textContent = recording.summary;
  } else {
    summarySection.style.display = "none";
  }

  // Update key points if available
  const keyPointsSection = document.getElementById(
    "detail-key-points-section",
  )!;
  if (recording.key_points.length > 0) {
    keyPointsSection.style.display = "block";
    const keyPointsList = document.getElementById("detail-key-points")!;
    keyPointsList.innerHTML = "";
    recording.key_points.forEach((point) => {
      const li = document.createElement("li");
      li.textContent = point;
      keyPointsList.appendChild(li);
    });
  } else {
    keyPointsSection.style.display = "none";
  }

  // Update action items if available
  const actionItemsSection = document.getElementById(
    "detail-action-items-section",
  )!;
  if (recording.action_items.length > 0) {
    actionItemsSection.style.display = "block";
    const actionItemsList = document.getElementById("detail-action-items")!;
    actionItemsList.innerHTML = "";
    recording.action_items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      actionItemsList.appendChild(li);
    });
  } else {
    actionItemsSection.style.display = "none";
  }

  // Show detail view
  recordingDetailView.style.display = "block";
}

function hideRecordingDetail() {
  recordingDetailView.style.display = "none";
  currentRecording = null;
}

async function deleteRecording(recordingId: string) {
  if (!confirm("Are you sure you want to delete this recording?")) {
    return;
  }

  try {
    await invoke("delete_recording", { id: recordingId });

    // Reload recordings for current project
    if (currentProject) {
      await loadRecordings(currentProject.id);
    }

    // Hide detail view if this recording is being viewed
    if (currentRecording && currentRecording.id === recordingId) {
      hideRecordingDetail();
    }
  } catch (error) {
    console.error("Failed to delete recording:", error);
    alert(`Failed to delete recording: ${error}`);
  }
}

async function generateSummaryForRecording(recordingId: string) {
  const claudeApiKey = claudeApiKeyInput.value.trim();

  if (!claudeApiKey) {
    alert(
      "Please enter your Claude API key in Settings to generate summaries.",
    );
    showSettingsDialog();
    return;
  }

  const generateBtn = document.getElementById(
    "detail-generate-summary-btn",
  )! as HTMLButtonElement;

  try {
    // Disable button and show loading state
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";

    // Call backend to generate summary
    const updatedRecording = await invoke<Recording>(
      "generate_recording_summary",
      {
        recordingId,
        claudeApiKey,
      },
    );

    // Update current recording
    currentRecording = updatedRecording;

    // Refresh the detail view with updated recording
    showRecordingDetail(updatedRecording);

    alert("Summary generated successfully!");
  } catch (error) {
    console.error("Failed to generate summary:", error);
    alert(
      `Failed to generate summary: ${error}\n\nPlease try again. If the error persists, check your Claude API key and internet connection.`,
    );

    // Re-enable button
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Summary";
  }
}

async function exportRecording(recording: Recording) {
  const content = `RECORDING: ${recording.name}
Created: ${new Date(recording.created_at * 1000).toLocaleString()}
Duration: ${Math.round(recording.metadata.duration_seconds)}s
Words: ${recording.metadata.word_count}

${recording.summary ? `SUMMARY\n${recording.summary}\n\n` : ""}${
    recording.key_points.length > 0
      ? `KEY POINTS\n${recording.key_points.map((p: string) => `- ${p}`).join("\n")}\n\n`
      : ""
  }${
    recording.action_items.length > 0
      ? `ACTION ITEMS\n${recording.action_items.map((i: string) => `- ${i}`).join("\n")}\n\n`
      : ""
  }ENHANCED TRANSCRIPT
${recording.enhanced_transcript}

RAW TRANSCRIPT
${recording.raw_transcript}
`;

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${recording.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== MODAL DIALOG FUNCTIONS =====

function showNewProjectDialog() {
  newProjectDialog.style.display = "flex";
  const nameInput = document.getElementById("project-name") as HTMLInputElement;
  nameInput.value = "";
  (
    document.getElementById("project-description") as HTMLTextAreaElement
  ).value = "";
  nameInput.focus();
}

function hideNewProjectDialog() {
  newProjectDialog.style.display = "none";
}

async function handleCreateProject() {
  const nameInput = document.getElementById("project-name") as HTMLInputElement;
  const descInput = document.getElementById(
    "project-description",
  ) as HTMLTextAreaElement;

  const name = nameInput.value.trim();
  const description = descInput.value.trim();

  if (!name) {
    alert("Please enter a project name");
    return;
  }

  try {
    await createProject(name, description);
    hideNewProjectDialog();
  } catch (error) {
    alert(`Failed to create project: ${error}`);
  }
}

async function showSaveRecordingDialog() {
  if (!currentProject) {
    alert("Please select a project first");
    return;
  }

  saveRecordingDialog.style.display = "flex";

  // Get session data from backend for accurate preview
  try {
    const session = await invoke<any>("get_current_session");

    if (session) {
      document.getElementById("preview-project")!.textContent =
        currentProject.name;
      document.getElementById("preview-duration")!.textContent = Math.round(
        session.metadata.duration_seconds,
      ).toString();
      document.getElementById("preview-words")!.textContent =
        session.metadata.word_count.toString();
      document.getElementById("preview-turns")!.textContent =
        session.metadata.turn_count.toString();
    } else {
      // Fallback to frontend estimates if no session
      document.getElementById("preview-project")!.textContent =
        currentProject.name;
      document.getElementById("preview-duration")!.textContent = "0";
      document.getElementById("preview-words")!.textContent = "0";
      document.getElementById("preview-turns")!.textContent = "0";
    }
  } catch (error) {
    console.error("Failed to get session data:", error);
    // Fallback to showing project name at least
    document.getElementById("preview-project")!.textContent =
      currentProject.name;
  }

  // Focus name input
  const nameInput = document.getElementById(
    "recording-name",
  ) as HTMLInputElement;
  const now = new Date();
  nameInput.value = `Recording ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  nameInput.select();
}

function hideSaveRecordingDialog() {
  saveRecordingDialog.style.display = "none";
}

function showSettingsDialog() {
  settingsDialog.style.display = "flex";
}

function hideSettingsDialog() {
  settingsDialog.style.display = "none";
}

function handleSaveSettings() {
  // Settings are auto-saved since they're bound to the same inputs
  // Just close the dialog
  hideSettingsDialog();
}

async function handleSaveRecording() {
  if (!currentProject) {
    alert("No project selected");
    return;
  }

  const nameInput = document.getElementById(
    "recording-name",
  ) as HTMLInputElement;
  const name = nameInput.value.trim();

  if (!name) {
    alert("Please enter a recording name");
    return;
  }

  try {
    // Backend automatically gets session data and metadata
    // Frontend just provides name and summary (if available)
    await invoke("save_recording", {
      name,
      summary: lastSummary?.summary || null,
      keyPoints: lastSummary?.key_points || [],
      actionItems: lastSummary?.action_items || [],
    });

    hideSaveRecordingDialog();

    // Reload recordings
    await loadRecordings(currentProject.id);

    alert("Recording saved successfully!");
  } catch (error) {
    console.error("Failed to save recording:", error);
    alert(`Failed to save recording: ${error}`);
  }
}

// Utility function to escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Check for updates on app startup
async function checkForUpdates() {
  try {
    console.log("Checking for updates...");
    const update = await check();

    if (update) {
      console.log(`Update available: ${update.version}`);

      const userConfirmed = await ask(
        `A new version (${update.version}) is available!\n\nWould you like to download and install it now?`,
        {
          title: "Update Available",
          kind: "info",
          okLabel: "Update Now",
          cancelLabel: "Later",
        },
      );

      if (userConfirmed) {
        console.log("Downloading and installing update...");

        // Show status during download
        statusIndicator.textContent = "Downloading update...";
        statusIndicator.className = "status connecting";

        await update.downloadAndInstall();

        // Relaunch the app to apply the update
        await relaunch();
      } else {
        console.log("Update declined by user");
      }
    } else {
      console.log("No updates available");
    }
  } catch (error) {
    console.error("Failed to check for updates:", error);
    // Don't show error to user on startup - updates are optional
  }
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

  // Multi-project UI elements
  projectsList = document.querySelector("#projects-list")!;
  newProjectBtn = document.querySelector("#new-project-btn")!;
  currentProjectIndicator = document.querySelector(
    "#current-project-indicator",
  )!;
  recordingsList = document.querySelector("#recordings-list")!;
  recordingsEmptyState = document.querySelector("#recordings-empty-state")!;
  recordingCount = document.querySelector("#recording-count")!;
  newProjectDialog = document.querySelector("#new-project-dialog")!;
  saveRecordingDialog = document.querySelector("#save-recording-dialog")!;
  settingsDialog = document.querySelector("#settings-dialog")!;
  recordingDetailView = document.querySelector("#recording-detail-view")!;

  // Refinement settings UI
  refinementModeRadios = document.querySelectorAll(
    'input[name="refinement-mode"]',
  );
  chunkDurationInput = document.querySelector("#chunk-duration-input")!;
  chunkDurationGroup = document.querySelector("#chunk-duration-group")!;

  // Load audio devices and projects
  await loadAudioDevices();
  await loadProjects();

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

  // Project management
  newProjectBtn.addEventListener("click", showNewProjectDialog);
  document
    .getElementById("create-project-btn")!
    .addEventListener("click", handleCreateProject);
  document
    .getElementById("cancel-project-btn")!
    .addEventListener("click", hideNewProjectDialog);
  document
    .getElementById("close-project-dialog")!
    .addEventListener("click", hideNewProjectDialog);

  // Save recording dialog
  document
    .getElementById("confirm-save-btn")!
    .addEventListener("click", handleSaveRecording);
  document
    .getElementById("cancel-save-btn")!
    .addEventListener("click", hideSaveRecordingDialog);
  document
    .getElementById("close-save-dialog")!
    .addEventListener("click", hideSaveRecordingDialog);

  // Settings dialog
  document
    .getElementById("settings-btn")!
    .addEventListener("click", showSettingsDialog);
  document
    .getElementById("save-settings-btn")!
    .addEventListener("click", handleSaveSettings);
  document
    .getElementById("cancel-settings-btn")!
    .addEventListener("click", hideSettingsDialog);
  document
    .getElementById("close-settings-dialog")!
    .addEventListener("click", hideSettingsDialog);

  // Recording detail view
  document
    .getElementById("back-to-list-btn")!
    .addEventListener("click", hideRecordingDetail);
  document
    .getElementById("detail-generate-summary-btn")!
    .addEventListener("click", async () => {
      if (currentRecording) {
        await generateSummaryForRecording(currentRecording.id);
      }
    });
  document
    .getElementById("detail-export-btn")!
    .addEventListener("click", () => {
      if (currentRecording) {
        exportRecording(currentRecording);
      }
    });
  document
    .getElementById("detail-delete-btn")!
    .addEventListener("click", async () => {
      if (currentRecording) {
        await deleteRecording(currentRecording.id);
      }
    });

  // Allow Enter key to submit dialogs
  document.getElementById("project-name")!.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleCreateProject();
    }
  });

  document
    .getElementById("recording-name")!
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSaveRecording();
      }
    });

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

  // Load refinement settings from localStorage
  const savedRefinementMode =
    (localStorage.getItem("refinement_mode") as RefinementMode) || "chunked";
  const savedChunkDuration = localStorage.getItem("chunk_duration") || "10";

  // Set saved values
  const modeRadio = document.querySelector(
    `input[name="refinement-mode"][value="${savedRefinementMode}"]`,
  ) as HTMLInputElement;
  if (modeRadio) {
    modeRadio.checked = true;
  }
  chunkDurationInput.value = savedChunkDuration;

  // Update chunk duration visibility based on mode
  function updateChunkDurationVisibility() {
    const selectedMode = (
      document.querySelector(
        'input[name="refinement-mode"]:checked',
      ) as HTMLInputElement
    )?.value;
    if (selectedMode === "chunked") {
      chunkDurationGroup.style.display = "block";
    } else {
      chunkDurationGroup.style.display = "none";
    }
  }

  // Initial visibility update
  updateChunkDurationVisibility();

  // Add event listeners for refinement mode changes
  refinementModeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      updateChunkDurationVisibility();
      // Save mode to localStorage
      localStorage.setItem("refinement_mode", radio.value);
    });
  });

  // Save chunk duration on change
  chunkDurationInput.addEventListener("change", () => {
    localStorage.setItem("chunk_duration", chunkDurationInput.value);
  });

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

  // Check for updates after app loads
  await checkForUpdates();

  // Initialize diagnostics tab
  initDiagnostics();
});
