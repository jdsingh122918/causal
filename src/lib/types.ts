// Audio Device Types
export interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  device_type: "Input" | "Output";
}

// Transcription Types
export interface WordResult {
  text: string;
  start: number;
  end: number;
  confidence: number;
  is_final: boolean;
}

export interface TranscriptResult {
  text: string;
  confidence: number;
  is_final: boolean;
  turn_order: number;
  end_of_turn: boolean;
  words: WordResult[];
}

export interface EnhancedTranscript {
  buffer_id: number;
  raw_text: string;
  enhanced_text: string;
  processing_time_ms: number;
  model_used: string;
}

export interface TranscriptSummary {
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

// Business Intelligence Types
export type AnalysisType =
  | "Sentiment"
  | "Financial"
  | "Competitive"
  | "Summary"
  | "Risk";

export interface IntelligenceConfig {
  enabled: boolean;
  analyses: AnalysisType[];
  autoAnalyze: boolean;
  analysisFrequency: "sentence" | "paragraph" | "manual";
}

// Project Types
export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: number; // SystemTime as Unix timestamp
  updated_at: number;
  intelligence?: IntelligenceConfig; // Optional BI configuration
}

export interface CreateProjectRequest {
  name: string;
  description: string;
}

// Recording Types
export interface RecordingMetadata {
  duration_seconds: number;
  word_count: number;
  chunk_count: number;
  turn_count: number;
  average_confidence: number;
}

export interface Recording {
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

// Refinement Configuration
export type RefinementMode = "disabled" | "realtime" | "chunked";

export interface RefinementConfig {
  mode: RefinementMode;
  chunk_duration_secs: number;
}

// Settings Types
export interface AppSettings {
  selected_device_id: string | null;
  assembly_api_key: string;
  claude_api_key: string;
  refinement_config: RefinementConfig;
}

// UI State Types
export type TabName = "recording" | "summary";

export type RecordingStatus =
  | "idle"
  | "recording"
  | "processing"
  | "completed"
  | "error";

// Turn Buffer for smoother UI updates
export interface TurnBufferItem {
  turnOrder: number;
  text: string;
  timestamp: number;
}
