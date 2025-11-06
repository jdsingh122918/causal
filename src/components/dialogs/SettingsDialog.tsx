import { useState, useEffect } from "react";
import {
  Dialog,
  ResizableDialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/contexts/SettingsContext";
import { RefinementMode } from "@/lib/types";
import { toast } from "sonner";
import { Mic, Key, Sparkles, Save, X, RefreshCw } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const {
    audioDevices,
    selectedDeviceId,
    assemblyApiKey,
    claudeApiKey,
    refinementConfig,
    loadAudioDevices,
    saveSettings,
  } = useSettings();

  // Debug logging for context values
  console.log("🎛️ [SettingsDialog] Context values:", {
    assemblyApiKey: assemblyApiKey ? `${assemblyApiKey.slice(0, 10)}...` : "empty",
    claudeApiKey: claudeApiKey ? `${claudeApiKey.slice(0, 10)}...` : "empty",
    selectedDeviceId,
    refinementConfig
  });

  const [localDeviceId, setLocalDeviceId] = useState(selectedDeviceId || "");
  const [localAssemblyKey, setLocalAssemblyKey] = useState(assemblyApiKey);
  const [localClaudeKey, setLocalClaudeKey] = useState(claudeApiKey);
  const [localMode, setLocalMode] = useState<RefinementMode>(refinementConfig.mode);
  const [localChunkDuration, setLocalChunkDuration] = useState(
    refinementConfig.chunk_duration_secs
  );
  const [loading, setLoading] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);

  useEffect(() => {
    if (open) {
      const loadDevices = async () => {
        setLoadingDevices(true);
        try {
          await loadAudioDevices();
        } catch (error) {
          console.error("Failed to load audio devices:", error);
        } finally {
          setLoadingDevices(false);
        }
      };

      loadDevices();
      setLocalDeviceId(selectedDeviceId || "");
      setLocalAssemblyKey(assemblyApiKey);
      setLocalClaudeKey(claudeApiKey);
      setLocalMode(refinementConfig.mode);
      setLocalChunkDuration(refinementConfig.chunk_duration_secs);
    }
  }, [open, selectedDeviceId, assemblyApiKey, claudeApiKey, refinementConfig]);

  // Update local state when context values change (e.g., after loading from database)
  useEffect(() => {
    console.log("🎛️ [SettingsDialog] useEffect triggered - updating local state with context values");
    console.log("🎛️ [SettingsDialog] Context values received:", {
      assemblyApiKey: assemblyApiKey ? `${assemblyApiKey.slice(0, 10)}...` : "empty",
      claudeApiKey: claudeApiKey ? `${claudeApiKey.slice(0, 10)}...` : "empty",
      selectedDeviceId,
      refinementConfig
    });

    setLocalDeviceId(selectedDeviceId || "");
    setLocalAssemblyKey(assemblyApiKey);
    setLocalClaudeKey(claudeApiKey);
    setLocalMode(refinementConfig.mode);
    setLocalChunkDuration(refinementConfig.chunk_duration_secs);

    console.log("🎛️ [SettingsDialog] Local state updated:", {
      localAssemblyKey: assemblyApiKey ? `${assemblyApiKey.slice(0, 10)}...` : "empty",
      localClaudeKey: claudeApiKey ? `${claudeApiKey.slice(0, 10)}...` : "empty"
    });
  }, [selectedDeviceId, assemblyApiKey, claudeApiKey, refinementConfig]);


  const handleSave = () => {
    try {
      setLoading(true);
      saveSettings({
        selected_device_id: localDeviceId || null,
        assembly_api_key: localAssemblyKey,
        claude_api_key: localClaudeKey,
        refinement_config: {
          mode: localMode,
          chunk_duration_secs: localChunkDuration,
        },
      });
      toast.success("Settings saved successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResizableDialogContent
        initialWidth="700px"
        initialHeight="600px"
        minWidth="500px"
        minHeight="400px"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Settings</DialogTitle>
          <DialogDescription>
            Configure audio device, API keys, and AI refinement options.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 h-0 pr-6">
          <div className="space-y-6 pb-6">
          {/* Audio Device Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Audio Input</h3>
            </div>
            <div className="space-y-2 pl-7">
              <div className="flex items-center justify-between">
                <Label htmlFor="audio-device" className="text-sm font-medium">
                  Microphone Device
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setLoadingDevices(true);
                    try {
                      await loadAudioDevices();
                    } finally {
                      setLoadingDevices(false);
                    }
                  }}
                  disabled={loadingDevices}
                  className="h-6 px-2"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingDevices ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <Select value={localDeviceId} onValueChange={setLocalDeviceId}>
                <SelectTrigger id="audio-device" className="h-11">
                  <SelectValue placeholder={loadingDevices ? "Loading audio devices..." : "Select audio device"} />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="z-[110]">
                  {audioDevices.length === 0 ? (
                    <SelectItem value="" disabled>
                      {loadingDevices ? "Loading devices..." : "No audio devices found"}
                    </SelectItem>
                  ) : (
                    audioDevices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.name} {device.is_default ? "(Default)" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the microphone to use for recording
              </p>
            </div>
          </div>

          <Separator />

          {/* API Keys Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">API Keys</h3>
            </div>
            <div className="space-y-4 pl-7">
              <div className="space-y-2">
                <Label htmlFor="assembly-key" className="text-sm font-medium">
                  AssemblyAI API Key
                </Label>
                <Input
                  id="assembly-key"
                  type="password"
                  placeholder="Enter your AssemblyAI API key"
                  value={localAssemblyKey}
                  onChange={(e) => setLocalAssemblyKey(e.target.value)}
                  className="h-11 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Required for real-time transcription
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="claude-key" className="text-sm font-medium">
                  Anthropic API Key (Claude)
                </Label>
                <Input
                  id="claude-key"
                  type="password"
                  placeholder="Enter your Anthropic API key"
                  value={localClaudeKey}
                  onChange={(e) => setLocalClaudeKey(e.target.value)}
                  className="h-11 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Required for AI-powered summaries and refinement
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* AI Refinement Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">AI Refinement</h3>
            </div>
            <div className="space-y-4 pl-7">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Processing Mode</Label>
                <RadioGroup value={localMode} onValueChange={(v) => setLocalMode(v as RefinementMode)}>
                  <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                    <RadioGroupItem value="disabled" id="disabled" className="mt-0.5" />
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="disabled" className="font-medium cursor-pointer">
                        Disabled
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Raw transcript only, no AI enhancement
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                    <RadioGroupItem value="realtime" id="realtime" className="mt-0.5" />
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="realtime" className="font-medium cursor-pointer">
                        Real-time
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Enhance transcript as you speak (requires Claude API key)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                    <RadioGroupItem value="chunked" id="chunked" className="mt-0.5" />
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="chunked" className="font-medium cursor-pointer">
                        Chunked
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Process transcript in time intervals (requires Claude API key)
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {localMode === "chunked" && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="chunk-duration" className="text-sm font-medium">
                    Chunk Duration (seconds)
                  </Label>
                  <Input
                    id="chunk-duration"
                    type="number"
                    min="10"
                    max="300"
                    value={localChunkDuration}
                    onChange={(e) => setLocalChunkDuration(Number(e.target.value))}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Process transcript every {localChunkDuration} seconds
                  </p>
                </div>
              )}
            </div>
          </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="gap-2"
            size="lg"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="gap-2"
            size="lg"
          >
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </ResizableDialogContent>
    </Dialog>
  );
}
