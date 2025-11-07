import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjects } from "@/contexts/ProjectsContext";
import { useSettings } from "@/contexts/SettingsContext";
import type { IntelligenceConfig, AnalysisType } from "@/lib/types";
import { Brain, Heart, DollarSign, TrendingUp, FileText, Shield, Save, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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

export function IntelligenceSettingsPage() {
  const navigate = useNavigate();
  const { currentProject, getProjectIntelligence, updateProjectIntelligence } = useProjects();
  const { claudeApiKey } = useSettings();

  const [config, setConfig] = useState<IntelligenceConfig>({
    enabled: false,
    analyses: ["Sentiment", "Financial", "Competitive", "Summary", "Risk"],
    autoAnalyze: true,
    analysisFrequency: "sentence",
  });
  const [loading, setLoading] = useState(false);

  // Load project intelligence config on mount
  useEffect(() => {
    if (currentProject) {
      const existingConfig = getProjectIntelligence(currentProject.id);
      if (existingConfig) {
        setConfig(existingConfig);
      }
    }
  }, [currentProject, getProjectIntelligence]);

  const handleSave = async () => {
    if (!currentProject) {
      toast.error("No project selected");
      return;
    }

    try {
      setLoading(true);
      await updateProjectIntelligence(currentProject.id, config);
      toast.success("Intelligence settings saved successfully");
      navigate('/');
    } catch (error) {
      toast.error("Failed to save intelligence settings");
      console.error("Failed to save intelligence settings:", error);
    } finally {
      setLoading(false);
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

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">No Project Selected</h2>
          <p className="text-muted-foreground mb-4">
            Please select a project to configure intelligence settings.
          </p>
          <Button onClick={() => navigate('/')}>
            Go to Projects
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8" />
              Intelligence Settings
            </h1>
            <p className="text-muted-foreground">
              Configure Business Intelligence for {currentProject.name}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-240px)]">
        <div className="space-y-6 pr-6">
          {/* API Key Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Configuration</CardTitle>
              <CardDescription>
                Intelligence features use the Claude API key from global settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${claudeApiKey ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="font-medium">Anthropic API Key</p>
                    <p className="text-sm text-muted-foreground">
                      {claudeApiKey ? 'Configured and ready' : 'Not configured'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/settings')}
                >
                  Go to Settings
                </Button>
              </div>
              {!claudeApiKey && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    An API key is required to enable intelligence features. Configure it in Settings.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enable/Disable Intelligence */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enable Intelligence</CardTitle>
              <CardDescription>
                Toggle Business Intelligence analysis for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Switch
                  id="intelligence-enabled"
                  checked={config.enabled}
                  disabled={!claudeApiKey}
                  onCheckedChange={(checked: boolean) =>
                    setConfig(prev => ({ ...prev, enabled: checked }))
                  }
                />
                <Label htmlFor="intelligence-enabled">
                  Enable real-time business intelligence analysis
                </Label>
              </div>
              {config.enabled && (
                <p className="text-sm text-muted-foreground mt-3">
                  Intelligence sidebar will be available during recording sessions
                </p>
              )}
            </CardContent>
          </Card>

          {/* Analysis Types */}
          {config.enabled && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Analysis Types</CardTitle>
                    <CardDescription>
                      Select which types of analysis to perform
                    </CardDescription>
                  </div>
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
              <CardHeader>
                <CardTitle className="text-base">Auto-Analysis</CardTitle>
                <CardDescription>
                  Configure automatic analysis behavior during recording
                </CardDescription>
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
      </ScrollArea>

      {/* Fixed Save Button */}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          variant="outline"
          onClick={() => navigate('/')}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || !claudeApiKey}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {loading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
