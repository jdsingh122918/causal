import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "./SettingsContext";

// Intelligence types (matching Rust backend)
export interface SentimentAnalysis {
  overall_sentiment: string;
  confidence: number;
  emotional_tone: string[];
  key_phrases: string[];
}

export interface FinancialAnalysis {
  metrics: Record<string, number>;
  currencies: string[];
  percentages: number[];
  financial_terms: string[];
  outlook?: string;
}

export interface CompetitiveAnalysis {
  competitors_mentioned: string[];
  competitive_positioning?: string;
  market_share_mentions: string[];
  competitive_advantages: string[];
  threats_identified: string[];
  // Enhanced financial analyst insights
  industry_impact?: string;
  company_effects: string[];
  strategic_questions: string[];
  competitive_moats: string[];
  market_dynamics?: string;
}

export interface SummaryAnalysis {
  key_points: string[];
  action_items: string[];
  decisions_made: string[];
  business_impact?: string;
  follow_up_required: string[];
}

export interface PromiseCommitment {
  promise_text: string;
  promise_type: string;
  specificity: string;
  timeline?: string;
  stakeholder?: string;
}

export interface DeliveryRisk {
  risk_area: string;
  risk_category: string;
  severity: string;
  likelihood: string;
  risk_factors: string[];
  potential_impact: string;
  mitigation_notes?: string;
}

export interface RiskAnalysis {
  // Overall risk assessment
  overall_risk_level: string;
  risk_summary: string;

  // Promise detection and analysis
  promises_identified: PromiseCommitment[];
  promise_clarity_score: number;

  // Delivery risk assessment
  delivery_risks: DeliveryRisk[];
  critical_risks: string[];

  // Traditional risk categories
  operational_risks: string[];
  financial_risks: string[];
  market_risks: string[];
  regulatory_risks: string[];

  // Mitigation and recommendations
  existing_mitigations: string[];
  recommended_actions: string[];
}

export type AnalysisType = "Sentiment" | "Financial" | "Competitive" | "Summary" | "Risk";

// Vector database types for historical context
export interface SimilarAnalysis {
  id: string;
  analysis_type: string;
  content: string;
  similarity_score: number;
  timestamp: string;
  recording_id?: string;
  project_id?: string;
}

export interface SearchFilters {
  project_id?: string;
  analysis_types?: string[];
  date_range?: {
    start_timestamp: number;
    end_timestamp: number;
  };
  top_k?: number;
  min_similarity?: number;
}

export interface IntelligenceResult {
  buffer_id: number;
  analysis_type: AnalysisType;
  processing_time_ms: number;
  model_used: string;
  raw_text: string;
  timestamp: string;
  similarity_score?: number; // NEW: For historical context
  related_analyses?: SimilarAnalysis[]; // NEW: Historical context data
  sentiment?: SentimentAnalysis;
  financial?: FinancialAnalysis;
  competitive?: CompetitiveAnalysis;
  summary?: SummaryAnalysis;
  risk?: RiskAnalysis;
}

export interface CombinedIntelligence {
  buffer_id: number;
  timestamp: string;
  results: Record<AnalysisType, IntelligenceResult>;
  processing_complete: boolean;
}

export interface IntelligenceConfig {
  enabled_analyses: AnalysisType[];
  api_key: string;
  model: string;
  max_tokens: number;
  temperature: number;
  concurrent_agents: number;
}

export interface IntelligenceEvent {
  buffer_id: number;
  analysis_type: AnalysisType;
  result: IntelligenceResult;
  all_analyses_complete: boolean;
}

export interface AnalysisTypeInfo {
  type: string;
  name: string;
  description: string;
  output: string[];
}

interface IntelligenceState {
  config: IntelligenceConfig;
  isInitialized: boolean;
  isProcessing: boolean;
  latestResults: Map<number, CombinedIntelligence>;
  realtimeResults: Map<number, IntelligenceEvent>;
  availableAnalysisTypes: AnalysisTypeInfo[];
  systemStatus: {
    is_running: boolean;
    enabled_analyses: string[];
    agent_count: number;
    model: string;
    concurrent_agents: number;
    has_coordinator: boolean;
    has_api_key: boolean;
  } | null;
}

interface IntelligenceContextType {
  state: IntelligenceState;

  // Configuration
  updateConfig: (config: Partial<IntelligenceConfig>) => Promise<void>;
  initializeSystem: () => Promise<void>;
  clearSystem: () => Promise<void>;
  testConnectivity: () => Promise<{ status: string; response_time_ms?: number; error?: string }>;

  // Analysis
  analyzeText: (text: string, bufferId?: number) => Promise<CombinedIntelligence>;

  // Event handling
  clearResults: () => void;
  getResultsForBuffer: (bufferId: number) => CombinedIntelligence | undefined;

  // Status
  refreshStatus: () => Promise<void>;
  getAvailableAnalysisTypes: () => Promise<void>;
}

const defaultConfig: IntelligenceConfig = {
  enabled_analyses: ["Sentiment", "Financial", "Summary"],
  api_key: "",
  model: "claude-haiku-4-5-20251001",
  max_tokens: 4096,
  temperature: 0.3,
  concurrent_agents: 4,
};

const IntelligenceContext = createContext<IntelligenceContextType | undefined>(undefined);

export function IntelligenceProvider({ children }: { children: React.ReactNode }) {
  const { claudeApiKey } = useSettings();
  const [state, setState] = useState<IntelligenceState>({
    config: defaultConfig,
    isInitialized: false,
    isProcessing: false,
    latestResults: new Map(),
    realtimeResults: new Map(),
    availableAnalysisTypes: [],
    systemStatus: null,
  });

  // Load configuration and status on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load current config
        const config = await invoke<IntelligenceConfig>("get_intelligence_config");
        setState(prev => ({ ...prev, config }));
      } catch (error) {
        console.warn("Failed to load intelligence config:", error);
      }

      try {
        // Load available analysis types
        const types = await invoke<AnalysisTypeInfo[]>("get_available_analysis_types");
        setState(prev => ({ ...prev, availableAnalysisTypes: types }));
      } catch (error) {
        console.error("Failed to load analysis types:", error);
      }

      // Refresh status
      await refreshStatus();
    };

    loadInitialData();
  }, []);

  // Listen for intelligence events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupEventListener = async () => {
      try {
        unlisten = await listen<IntelligenceEvent>("intelligence_result", (event) => {
          const intelligenceEvent = event.payload;

          setState(prev => {
            const updatedRealtimeResults = new Map(prev.realtimeResults.set(intelligenceEvent.buffer_id, intelligenceEvent));

            // If all analyses are complete, update the combined results
            if (intelligenceEvent.all_analyses_complete) {
              // Collect all results for this buffer
              const bufferResults = new Map<AnalysisType, IntelligenceResult>();
              bufferResults.set(intelligenceEvent.analysis_type, intelligenceEvent.result);

              // Add other results for the same buffer if they exist
              updatedRealtimeResults.forEach((event) => {
                if (event.buffer_id === intelligenceEvent.buffer_id) {
                  bufferResults.set(event.analysis_type, event.result);
                }
              });

              const combinedResult: CombinedIntelligence = {
                buffer_id: intelligenceEvent.buffer_id,
                timestamp: intelligenceEvent.result.timestamp,
                results: Object.fromEntries(bufferResults) as Record<AnalysisType, IntelligenceResult>,
                processing_complete: true,
              };

              return {
                ...prev,
                realtimeResults: updatedRealtimeResults,
                latestResults: new Map(prev.latestResults.set(intelligenceEvent.buffer_id, combinedResult)),
              };
            }

            return {
              ...prev,
              realtimeResults: updatedRealtimeResults,
            };
          });
        });
      } catch (error) {
        console.error("Failed to setup intelligence event listener:", error);
      }
    };

    setupEventListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Update config with API key from settings and auto-initialize
  useEffect(() => {
    const updateApiKeyAndInitialize = async () => {
      if (!claudeApiKey) {
        console.log("🧠 [Intelligence] No Claude API key available, skipping initialization");
        return;
      }

      // Update config with API key from settings if it's different
      if (state.config.api_key !== claudeApiKey) {
        console.log("🧠 [Intelligence] Updating API key from settings");
        setState(prev => ({
          ...prev,
          config: { ...prev.config, api_key: claudeApiKey }
        }));

        try {
          // Update the backend config with the new API key
          const newConfig = { ...state.config, api_key: claudeApiKey };
          await invoke("set_intelligence_config", { config: newConfig });
        } catch (error) {
          console.error("Failed to update intelligence config with API key:", error);
        }
      }

      // Auto-initialize if we have an API key but system is not initialized
      if (claudeApiKey && !state.isInitialized && !state.isProcessing) {
        console.log("🧠 [Intelligence] Auto-initializing system with API key");
        try {
          setState(prev => ({ ...prev, isProcessing: true }));
          await invoke("initialize_intelligence_system");
          setState(prev => ({ ...prev, isInitialized: true }));

          // Refresh status after initialization
          try {
            const status = await invoke<IntelligenceState["systemStatus"]>("get_intelligence_status");
            setState(prev => ({ ...prev, systemStatus: status }));
          } catch (statusError) {
            console.error("Failed to refresh intelligence status after initialization:", statusError);
          }

          console.log("🧠 [Intelligence] System initialized successfully");
        } catch (error) {
          console.error("Failed to auto-initialize intelligence system:", error);
        } finally {
          setState(prev => ({ ...prev, isProcessing: false }));
        }
      }
    };

    updateApiKeyAndInitialize();
  }, [claudeApiKey, state.config.api_key, state.isInitialized, state.isProcessing]);

  const updateConfig = useCallback(async (configUpdate: Partial<IntelligenceConfig>) => {
    const newConfig = { ...state.config, ...configUpdate };

    try {
      await invoke("set_intelligence_config", { config: newConfig });
      setState(prev => ({ ...prev, config: newConfig }));
    } catch (error) {
      console.error("Failed to update intelligence config:", error);
      throw error;
    }
  }, [state.config]);

  const initializeSystem = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      await invoke("initialize_intelligence_system");
      setState(prev => ({ ...prev, isInitialized: true }));
      await refreshStatus();
    } catch (error) {
      console.error("Failed to initialize intelligence system:", error);
      throw error;
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, []);

  const clearSystem = useCallback(async () => {
    try {
      await invoke("clear_intelligence_system");
      setState(prev => ({
        ...prev,
        isInitialized: false,
        latestResults: new Map(),
        realtimeResults: new Map(),
      }));
      await refreshStatus();
    } catch (error) {
      console.error("Failed to clear intelligence system:", error);
      throw error;
    }
  }, []);

  const testConnectivity = useCallback(async () => {
    try {
      const result = await invoke<{ status: string; response_time_ms?: number; error?: string }>(
        "test_intelligence_connectivity"
      );
      return result;
    } catch (error) {
      console.error("Intelligence connectivity test failed:", error);
      throw error;
    }
  }, []);

  const analyzeText = useCallback(async (text: string, bufferId: number = Math.floor(Math.random() * 4294967295)) => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      const result = await invoke<CombinedIntelligence>("analyze_text_buffer", {
        bufferId,
        text,
      });

      setState(prev => ({
        ...prev,
        latestResults: new Map(prev.latestResults.set(bufferId, result)),
      }));

      return result;
    } catch (error) {
      console.error("Failed to analyze text:", error);
      throw error;
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await invoke<IntelligenceState["systemStatus"]>("get_intelligence_status");
      setState(prev => ({ ...prev, systemStatus: status }));
    } catch (error) {
      console.error("Failed to refresh intelligence status:", error);
    }
  }, []);

  const getAvailableAnalysisTypes = useCallback(async () => {
    try {
      const types = await invoke<AnalysisTypeInfo[]>("get_available_analysis_types");
      setState(prev => ({ ...prev, availableAnalysisTypes: types }));
    } catch (error) {
      console.error("Failed to get analysis types:", error);
    }
  }, []);

  const clearResults = useCallback(() => {
    console.log("🧠 [Intelligence] Clearing all intelligence results");
    setState(prev => ({
      ...prev,
      latestResults: new Map(),
      realtimeResults: new Map(),
    }));
  }, []);

  const getResultsForBuffer = useCallback((bufferId: number) => {
    return state.latestResults.get(bufferId);
  }, [state.latestResults]);

  const contextValue: IntelligenceContextType = {
    state,
    updateConfig,
    initializeSystem,
    clearSystem,
    testConnectivity,
    analyzeText,
    clearResults,
    getResultsForBuffer,
    refreshStatus,
    getAvailableAnalysisTypes,
  };

  return (
    <IntelligenceContext.Provider value={contextValue}>
      {children}
    </IntelligenceContext.Provider>
  );
}

export function useIntelligence() {
  const context = useContext(IntelligenceContext);
  if (context === undefined) {
    throw new Error("useIntelligence must be used within an IntelligenceProvider");
  }
  return context;
}