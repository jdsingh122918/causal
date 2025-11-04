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
      console.error("Failed to load audio devices:", error);
    }
  };

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved) as AppSettings;
        setSelectedDeviceId(settings.selected_device_id);
        setAssemblyApiKey(settings.assembly_api_key);
        setClaudeApiKey(settings.claude_api_key);
        setRefinementConfig(settings.refinement_config);
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
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
      console.error("Failed to save settings:", error);
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
