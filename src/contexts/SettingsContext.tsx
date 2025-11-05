import React, { createContext, useContext, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AudioDevice, RefinementConfig, AppSettings } from "@/lib/types";

interface SettingsContextType {
  audioDevices: AudioDevice[];
  selectedDeviceId: string | null;
  assemblyApiKey: string;
  claudeApiKey: string;
  refinementConfig: RefinementConfig;
  loadAudioDevices: () => Promise<void>;
  loadSettings: () => void;
  saveSettings: (settings: Partial<AppSettings>) => void;
  updateRefinementConfig: (config: RefinementConfig) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const STORAGE_KEY = "causal_settings";

// Type guard to validate AppSettings from localStorage
function isValidAppSettings(data: unknown): data is AppSettings {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required properties with proper types
  return (
    (typeof obj.selected_device_id === 'string' || obj.selected_device_id === null) &&
    typeof obj.assembly_api_key === 'string' &&
    typeof obj.claude_api_key === 'string' &&
    typeof obj.refinement_config === 'object' &&
    obj.refinement_config !== null &&
    isValidRefinementConfig(obj.refinement_config)
  );
}

// Type guard for RefinementConfig
function isValidRefinementConfig(data: unknown): data is RefinementConfig {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    (obj.mode === 'disabled' || obj.mode === 'realtime' || obj.mode === 'chunked') &&
    typeof obj.chunk_duration_secs === 'number' &&
    obj.chunk_duration_secs > 0
  );
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [assemblyApiKey, setAssemblyApiKey] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [refinementConfig, setRefinementConfig] = useState<RefinementConfig>({
    mode: "disabled",
    chunk_duration_secs: 30,
  });

  useEffect(() => {
    loadAudioDevices();
    loadSettings();
  }, []);

  const loadAudioDevices = async () => {
    try {
      const devices = await invoke<AudioDevice[]>("list_audio_devices");
      setAudioDevices(devices.filter((d) => d.device_type === "Input"));

      // Auto-select default device if none selected
      if (!selectedDeviceId) {
        const defaultDevice = devices.find(
          (d) => d.is_default && d.device_type === "Input"
        );
        if (defaultDevice) {
          setSelectedDeviceId(defaultDevice.id);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to load audio devices:", errorMessage);
    }
  };

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedData = JSON.parse(saved);

        // Validate the parsed data before using it
        if (isValidAppSettings(parsedData)) {
          setSelectedDeviceId(parsedData.selected_device_id);
          setAssemblyApiKey(parsedData.assembly_api_key);
          setClaudeApiKey(parsedData.claude_api_key);
          setRefinementConfig(parsedData.refinement_config);
        } else {
          console.warn("Invalid settings data in localStorage, using defaults");
          // Clear invalid data
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to load settings from localStorage:", errorMessage);
      // Clear corrupted data on parse errors
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const saveSettings = (settings: Partial<AppSettings>) => {
    try {
      const updatedSettings: AppSettings = {
        selected_device_id: settings.selected_device_id ?? selectedDeviceId,
        assembly_api_key: settings.assembly_api_key ?? assemblyApiKey,
        claude_api_key: settings.claude_api_key ?? claudeApiKey,
        refinement_config: settings.refinement_config ?? refinementConfig,
      };

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));

      // Update local state
      setSelectedDeviceId(updatedSettings.selected_device_id);
      setAssemblyApiKey(updatedSettings.assembly_api_key);
      setClaudeApiKey(updatedSettings.claude_api_key);
      setRefinementConfig(updatedSettings.refinement_config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to save settings:", errorMessage);
      throw error;
    }
  };

  const updateRefinementConfig = (config: RefinementConfig) => {
    setRefinementConfig(config);
  };

  return (
    <SettingsContext.Provider
      value={{
        audioDevices,
        selectedDeviceId,
        assemblyApiKey,
        claudeApiKey,
        refinementConfig,
        loadAudioDevices,
        loadSettings,
        saveSettings,
        updateRefinementConfig,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
