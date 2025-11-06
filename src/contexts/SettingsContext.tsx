import { createContext, useContext, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AudioDevice, RefinementConfig, AppSettings } from "@/lib/types";

interface SettingsContextType {
  audioDevices: AudioDevice[];
  selectedDeviceId: string | null;
  assemblyApiKey: string;
  claudeApiKey: string;
  refinementConfig: RefinementConfig;
  loadAudioDevices: () => Promise<void>;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<void>;
  updateRefinementConfig: (config: RefinementConfig) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const STORAGE_KEY = "causal_settings";

// Interface for non-sensitive settings stored in localStorage
interface NonSensitiveSettings {
  selected_device_id: string | null;
  refinement_config: RefinementConfig;
}

// Type guard to validate non-sensitive settings from localStorage
function isValidNonSensitiveSettings(data: unknown): data is NonSensitiveSettings {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required properties with proper types
  return (
    (typeof obj.selected_device_id === 'string' || obj.selected_device_id === null) &&
    typeof obj.refinement_config === 'object' &&
    obj.refinement_config !== null &&
    isValidRefinementConfig(obj.refinement_config)
  );
}

// Type guard to validate complete AppSettings (for backward compatibility)
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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initializeSettings = async () => {
      await loadAudioDevices();
      await loadSettings();
    };
    initializeSettings();
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

  const loadSettings = async () => {
    console.log("🔧 [SettingsContext] loadSettings() called");
    setIsLoading(true);
    try {
      // Migration from localStorage API keys to secure storage
      console.log("🔧 [SettingsContext] Starting migration...");
      await migrateFromLocalStorage();

      // Load non-sensitive settings from localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      console.log("🔧 [SettingsContext] localStorage data:", saved ? "found" : "not found");
      if (saved) {
        const parsedData = JSON.parse(saved);

        // Handle both old and new format
        if (isValidAppSettings(parsedData)) {
          console.log("🔧 [SettingsContext] Found old format settings, migrating...");
          // Old format with API keys in localStorage - migrate to secure storage

          // Save API keys to secure storage
          if (parsedData.assembly_api_key) {
            await invoke("save_secure_setting", {
              request: { key: "assembly_api_key", value: parsedData.assembly_api_key }
            });
          }
          if (parsedData.claude_api_key) {
            await invoke("save_secure_setting", {
              request: { key: "claude_api_key", value: parsedData.claude_api_key }
            });
          }

          // Save non-sensitive settings to new format
          const nonSensitiveSettings: NonSensitiveSettings = {
            selected_device_id: parsedData.selected_device_id,
            refinement_config: parsedData.refinement_config,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nonSensitiveSettings));

          // Update local state
          setSelectedDeviceId(parsedData.selected_device_id);
          setAssemblyApiKey(parsedData.assembly_api_key);
          setClaudeApiKey(parsedData.claude_api_key);
          setRefinementConfig(parsedData.refinement_config);
        } else if (isValidNonSensitiveSettings(parsedData)) {
          console.log("🔧 [SettingsContext] Found new format settings");
          // New format - load from localStorage and secure storage separately
          setSelectedDeviceId(parsedData.selected_device_id);
          setRefinementConfig(parsedData.refinement_config);
        } else {
          console.warn("Invalid settings data in localStorage, using defaults");
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // Load API keys from secure storage
      console.log("🔧 [SettingsContext] Loading API keys from secure storage...");
      await loadSecureSettings();

      console.log("🔧 [SettingsContext] loadSettings() completed");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to load settings:", errorMessage);
      // Clear corrupted data on parse errors
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const migrateFromLocalStorage = async () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsedData = JSON.parse(saved);
      if (isValidAppSettings(parsedData)) {
        // Check if already migrated by checking secure storage
        let existingAssemblyKey: string | null = null;
        let existingClaudeKey: string | null = null;

        try {
          existingAssemblyKey = await invoke<string | null>("load_secure_setting", { key: "assembly_api_key" });
        } catch (error) {
          console.warn("Failed to check existing assembly API key during migration:", error);
        }

        try {
          existingClaudeKey = await invoke<string | null>("load_secure_setting", { key: "claude_api_key" });
        } catch (error) {
          console.warn("Failed to check existing Claude API key during migration:", error);
        }

        // Only migrate if not already in secure storage
        if (!existingAssemblyKey && parsedData.assembly_api_key) {
          try {
            await invoke("save_secure_setting", {
              request: { key: "assembly_api_key", value: parsedData.assembly_api_key }
            });
          } catch (error) {
            console.warn("Failed to migrate assembly API key:", error);
          }
        }

        if (!existingClaudeKey && parsedData.claude_api_key) {
          try {
            await invoke("save_secure_setting", {
              request: { key: "claude_api_key", value: parsedData.claude_api_key }
            });
          } catch (error) {
            console.warn("Failed to migrate Claude API key:", error);
          }
        }
      }
    } catch (error) {
      console.warn("Migration from localStorage failed:", error);
    }
  };

  const loadSecureSettings = async () => {
    console.log("🔐 [SettingsContext] loadSecureSettings() called");
    try {
      // Load API keys separately with individual error handling
      let assemblyKey: string | null = "";
      let claudeKey: string | null = "";

      try {
        console.log("🔐 [SettingsContext] Loading assembly_api_key...");
        assemblyKey = await invoke<string | null>("load_secure_setting", { key: "assembly_api_key" });
        console.log("🔐 [SettingsContext] Assembly API key loaded:", assemblyKey ? `${assemblyKey.slice(0, 10)}...` : "null/empty");
      } catch (error) {
        console.warn("Failed to load assembly API key:", error);
        assemblyKey = "";
      }

      try {
        console.log("🔐 [SettingsContext] Loading claude_api_key...");
        claudeKey = await invoke<string | null>("load_secure_setting", { key: "claude_api_key" });
        console.log("🔐 [SettingsContext] Claude API key loaded:", claudeKey ? `${claudeKey.slice(0, 10)}...` : "null/empty");
      } catch (error) {
        console.warn("Failed to load Claude API key:", error);
        claudeKey = "";
      }

      const finalAssemblyKey = assemblyKey || "";
      const finalClaudeKey = claudeKey || "";

      console.log("🔐 [SettingsContext] Setting state - Assembly:", finalAssemblyKey ? `${finalAssemblyKey.slice(0, 10)}...` : "empty");
      console.log("🔐 [SettingsContext] Setting state - Claude:", finalClaudeKey ? `${finalClaudeKey.slice(0, 10)}...` : "empty");

      setAssemblyApiKey(finalAssemblyKey);
      setClaudeApiKey(finalClaudeKey);

      console.log("🔐 [SettingsContext] State updated successfully");
    } catch (error) {
      console.warn("Failed to load secure settings:", error);
      setAssemblyApiKey("");
      setClaudeApiKey("");
    }
  };

  const saveSettings = async (settings: Partial<AppSettings>) => {
    setIsLoading(true);
    try {
      // Determine what to save where
      const newSelectedDeviceId = settings.selected_device_id ?? selectedDeviceId;
      const newAssemblyApiKey = settings.assembly_api_key ?? assemblyApiKey;
      const newClaudeApiKey = settings.claude_api_key ?? claudeApiKey;
      const newRefinementConfig = settings.refinement_config ?? refinementConfig;

      // Save API keys to secure storage if they've changed
      if (settings.assembly_api_key !== undefined && settings.assembly_api_key !== assemblyApiKey) {
        await invoke("save_secure_setting", {
          request: { key: "assembly_api_key", value: settings.assembly_api_key }
        });
      }

      if (settings.claude_api_key !== undefined && settings.claude_api_key !== claudeApiKey) {
        await invoke("save_secure_setting", {
          request: { key: "claude_api_key", value: settings.claude_api_key }
        });
      }

      // Save non-sensitive settings to localStorage
      const nonSensitiveSettings: NonSensitiveSettings = {
        selected_device_id: newSelectedDeviceId,
        refinement_config: newRefinementConfig,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nonSensitiveSettings));

      // Update local state
      setSelectedDeviceId(newSelectedDeviceId);
      setAssemblyApiKey(newAssemblyApiKey);
      setClaudeApiKey(newClaudeApiKey);
      setRefinementConfig(newRefinementConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to save settings:", errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
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
        isLoading,
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
