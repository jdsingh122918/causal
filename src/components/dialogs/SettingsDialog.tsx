import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSettings } from "@/contexts/SettingsContext";
import { RefinementMode } from "@/lib/types";
import { toast } from "sonner";

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

  const [localDeviceId, setLocalDeviceId] = useState(selectedDeviceId || "");
  const [localAssemblyKey, setLocalAssemblyKey] = useState(assemblyApiKey);
  const [localClaudeKey, setLocalClaudeKey] = useState(claudeApiKey);
  const [localMode, setLocalMode] = useState<RefinementMode>(refinementConfig.mode);
  const [localChunkDuration, setLocalChunkDuration] = useState(
    refinementConfig.chunk_duration_secs
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadAudioDevices();
      setLocalDeviceId(selectedDeviceId || "");
      setLocalAssemblyKey(assemblyApiKey);
      setLocalClaudeKey(claudeApiKey);
      setLocalMode(refinementConfig.mode);
      setLocalChunkDuration(refinementConfig.chunk_duration_secs);
    }
  }, [open]);

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure audio device, API keys, and AI refinement options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Audio Device */}
          <div className="space-y-2">
            <Label htmlFor="audio-device">Audio Input Device</Label>
            <Select value={localDeviceId} onValueChange={setLocalDeviceId}>
              <SelectTrigger id="audio-device">
                <SelectValue placeholder="Select audio device" />
              </SelectTrigger>
              <SelectContent>
                {audioDevices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.name} {device.is_default ? "(Default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AssemblyAI API Key */}
          <div className="space-y-2">
            <Label htmlFor="assembly-key">AssemblyAI API Key</Label>
            <Input
              id="assembly-key"
              type="password"
              placeholder="Enter your AssemblyAI API key"
              value={localAssemblyKey}
              onChange={(e) => setLocalAssemblyKey(e.target.value)}
            />
          </div>

          {/* Claude API Key */}
          <div className="space-y-2">
            <Label htmlFor="claude-key">Claude API Key</Label>
            <Input
              id="claude-key"
              type="password"
              placeholder="Enter your Claude API key"
              value={localClaudeKey}
              onChange={(e) => setLocalClaudeKey(e.target.value)}
            />
          </div>

          {/* AI Refinement Mode */}
          <div className="space-y-3">
            <Label>AI Refinement Mode</Label>
            <RadioGroup value={localMode} onValueChange={(v) => setLocalMode(v as RefinementMode)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="disabled" id="disabled" />
                <Label htmlFor="disabled" className="font-normal">
                  Disabled - Raw transcript only
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="realtime" id="realtime" />
                <Label htmlFor="realtime" className="font-normal">
                  Real-time - Enhance as you speak
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="chunked" id="chunked" />
                <Label htmlFor="chunked" className="font-normal">
                  Chunked - Process in intervals
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Chunk Duration (conditional) */}
          {localMode === "chunked" && (
            <div className="space-y-2">
              <Label htmlFor="chunk-duration">Chunk Duration (seconds)</Label>
              <Input
                id="chunk-duration"
                type="number"
                min="10"
                max="300"
                value={localChunkDuration}
                onChange={(e) => setLocalChunkDuration(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Process transcript every {localChunkDuration} seconds
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
