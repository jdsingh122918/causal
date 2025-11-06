import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/contexts/ProjectsContext";
import type { IntelligenceConfig, AnalysisType } from "@/lib/types";
import { Brain, Heart, DollarSign, TrendingUp, FileText, Shield } from "lucide-react";
import { toast } from "sonner";

interface ProjectIntelligenceSettingsProps {
  projectId: string;
  children?: React.ReactNode;
}

const ANALYSIS_OPTIONS: Array<{
  type: AnalysisType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    type: "Sentiment",
    label: "Sentiment Analysis",
    description: "Analyze emotional tone and confidence levels",
    icon: Heart,
  },
  {
    type: "Financial",
    label: "Financial Analysis",
    description: "Extract financial metrics, percentages, and outlook",
    icon: DollarSign,
  },
  {
    type: "Competitive",
    label: "Competitive Analysis",
    description: "Identify competitors, market positioning, and threats",
    icon: TrendingUp,
  },
  {
    type: "Summary",
    label: "Summary Analysis",
    description: "Generate key points, action items, and decisions",
    icon: FileText,
  },
  {
    type: "Risk",
    label: "Risk Analysis",
    description: "Identify business risks and mitigation strategies",
    icon: Shield,
  },
];

export function ProjectIntelligenceSettings({ projectId, children }: ProjectIntelligenceSettingsProps) {
  const { getProjectIntelligence, updateProjectIntelligence } = useProjects();
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<IntelligenceConfig>({
    enabled: false,
    analyses: ["Sentiment", "Financial", "Competitive", "Summary", "Risk"],
    autoAnalyze: true,
    analysisFrequency: "sentence",
  });
  const [loading, setSaving] = useState(false);

  // Load project intelligence config when dialog opens
  useEffect(() => {
    if (isOpen && projectId) {
      const existingConfig = getProjectIntelligence(projectId);
      if (existingConfig) {
        setConfig(existingConfig);
      }
    }
  }, [isOpen, projectId, getProjectIntelligence]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProjectIntelligence(projectId, config);
      toast.success("Intelligence settings saved successfully");
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to save intelligence settings");
      console.error("Failed to save intelligence settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAnalysisToggle = (analysisType: AnalysisType, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      analyses: checked
        ? [...prev.analyses, analysisType]
        : prev.analyses.filter(type => type !== analysisType)
    }));
  };

  const handleSelectAllAnalyses = () => {
    const allTypes: AnalysisType[] = ["Sentiment", "Financial", "Competitive", "Summary", "Risk"];
    setConfig(prev => ({
      ...prev,
      analyses: allTypes
    }));
  };

  const handleDeselectAllAnalyses = () => {
    setConfig(prev => ({
      ...prev,
      analyses: []
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Brain className="h-4 w-4" />
            Intelligence Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Business Intelligence Settings
          </DialogTitle>
          <DialogDescription>
            Configure real-time AI analysis for this project. Intelligence features will be available during recording sessions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Enable/Disable Intelligence */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enable Intelligence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Switch
                  id="intelligence-enabled"
                  checked={config.enabled}
                  onCheckedChange={(checked: boolean) =>
                    setConfig(prev => ({ ...prev, enabled: checked }))
                  }
                />
                <Label htmlFor="intelligence-enabled">
                  Enable real-time business intelligence analysis
                </Label>
              </div>
              {config.enabled && (
                <p className="text-sm text-muted-foreground mt-2">
                  Intelligence sidebar will be available during recording sessions
                </p>
              )}
            </CardContent>
          </Card>

          {/* Analysis Types */}
          {config.enabled && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Analysis Types</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllAnalyses}
                      disabled={config.analyses.length === 5}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAllAnalyses}
                      disabled={config.analyses.length === 0}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {ANALYSIS_OPTIONS.map(({ type, label, description, icon: Icon }) => (
                    <div key={type} className="flex items-start space-x-3 p-3 rounded-lg border">
                      <Checkbox
                        id={`analysis-${type}`}
                        checked={config.analyses.includes(type)}
                        onCheckedChange={(checked: boolean) => handleAnalysisToggle(type, !!checked)}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <Label
                            htmlFor={`analysis-${type}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {label}
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {config.analyses.length > 0 && (
                  <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm font-medium mb-2">Selected Analyses:</p>
                    <div className="flex flex-wrap gap-2">
                      {config.analyses.map(type => (
                        <Badge key={type} variant="secondary">
                          {ANALYSIS_OPTIONS.find(opt => opt.type === type)?.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Auto-Analysis Settings */}
          {config.enabled && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Auto-Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-analyze"
                    checked={config.autoAnalyze}
                    onCheckedChange={(checked: boolean) =>
                      setConfig(prev => ({ ...prev, autoAnalyze: checked }))
                    }
                  />
                  <Label htmlFor="auto-analyze">
                    Automatically analyze transcript during recording
                  </Label>
                </div>

                {config.autoAnalyze && (
                  <div className="space-y-2">
                    <Label htmlFor="analysis-frequency">Analysis Frequency</Label>
                    <Select
                      value={config.analysisFrequency}
                      onValueChange={(value: 'sentence' | 'paragraph' | 'manual') =>
                        setConfig(prev => ({ ...prev, analysisFrequency: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select analysis frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sentence">After complete sentences</SelectItem>
                        <SelectItem value="paragraph">After paragraphs</SelectItem>
                        <SelectItem value="manual">Manual only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      How often to trigger automatic analysis during recording
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
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