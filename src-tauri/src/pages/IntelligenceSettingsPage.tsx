import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/contexts/SettingsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import {
  Brain,
  Settings,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Users,
  FileText,
  Clock,
  Zap,
  Shield
} from "lucide-react";

export function IntelligenceSettingsPage() {
  const { claudeApiKey } = useSettings();
  const { projects, getProjectIntelligence } = useProjects();
  const [globalSettings, setGlobalSettings] = useState({
    autoAnalyzeAll: true,
    realTimeAnalysis: true,
    batchProcessing: false,
    historicalContext: true,
    crossProjectLearning: false
  });

  const intelligenceAgents = [
    {
      id: "sentiment",
      name: "Sentiment Analysis",
      icon: <TrendingUp className="w-5 h-5" />,
      description: "Analyzes emotional tone and sentiment patterns in conversations",
      capabilities: ["Mood tracking", "Engagement levels", "Emotional insights"],
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    },
    {
      id: "financial",
      name: "Financial Analysis",
      icon: <DollarSign className="w-5 h-5" />,
      description: "Identifies financial topics, metrics, and business insights",
      capabilities: ["Revenue discussions", "Cost analysis", "Financial metrics"],
      color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    },
    {
      id: "competitive",
      name: "Competitive Intelligence",
      icon: <Users className="w-5 h-5" />,
      description: "Detects competitor mentions and market positioning insights",
      capabilities: ["Competitor analysis", "Market positioning", "Strategic insights"],
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
    },
    {
      id: "risk",
      name: "Risk Assessment",
      icon: <AlertTriangle className="w-5 h-5" />,
      description: "Identifies potential risks and challenges in discussions",
      capabilities: ["Risk identification", "Threat assessment", "Mitigation strategies"],
      color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    },
    {
      id: "summary",
      name: "Summary Generation",
      icon: <FileText className="w-5 h-5" />,
      description: "Creates concise summaries and key takeaways",
      capabilities: ["Key points extraction", "Action items", "Meeting summaries"],
      color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  ];

  const projectStats = projects.map(project => {
    const intelligence = getProjectIntelligence(project.id);
    return {
      name: project.name,
      enabled: intelligence?.enabled || false,
      analyses: intelligence?.analyses || []
    };
  });

  const enabledProjectsCount = projectStats.filter(p => p.enabled).length;

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8" />
          <div>
            <h1 className="text-3xl font-bold">Intelligence Settings</h1>
            <p className="text-muted-foreground">
              Configure AI analysis agents and global intelligence features
            </p>
          </div>
        </div>

        {!claudeApiKey && (
          <div className="p-4 border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Claude API Key Required</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Add your Claude API key in main settings to enable intelligence analysis features.
                </p>
                <Button variant="outline" size="sm" className="mt-2">
                  <Settings className="w-4 h-4 mr-2" />
                  Go to Settings
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Active Agents</p>
                <p className="text-2xl font-bold">{intelligenceAgents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Projects Enabled</p>
                <p className="text-2xl font-bold">{enabledProjectsCount}/{projects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Real-time</p>
                <p className="text-xl font-bold">{globalSettings.realTimeAnalysis ? "Enabled" : "Disabled"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">API Status</p>
                <p className="text-xl font-bold">{claudeApiKey ? "Ready" : "Missing"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intelligence Agents */}
      <Card>
        <CardHeader>
          <CardTitle>Available Intelligence Agents</CardTitle>
          <CardDescription>
            AI-powered analysis agents that provide insights from your transcriptions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {intelligenceAgents.map((agent) => (
            <div key={agent.id} className="p-4 border rounded-lg">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${agent.color}`}>
                  {agent.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{agent.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {agent.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {agent.capabilities.map((capability, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Global Intelligence Settings</CardTitle>
          <CardDescription>
            Configure how intelligence analysis works across all projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-analyze">Auto-analyze All Recordings</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically run intelligence analysis on all new recordings
                </p>
              </div>
              <Switch
                id="auto-analyze"
                checked={globalSettings.autoAnalyzeAll}
                onCheckedChange={(checked) =>
                  setGlobalSettings(prev => ({ ...prev, autoAnalyzeAll: checked }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="real-time">Real-time Analysis</Label>
                <p className="text-sm text-muted-foreground">
                  Generate insights during recording in real-time
                </p>
              </div>
              <Switch
                id="real-time"
                checked={globalSettings.realTimeAnalysis}
                onCheckedChange={(checked) =>
                  setGlobalSettings(prev => ({ ...prev, realTimeAnalysis: checked }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="historical">Historical Context</Label>
                <p className="text-sm text-muted-foreground">
                  Include context from previous recordings in analysis
                </p>
              </div>
              <Switch
                id="historical"
                checked={globalSettings.historicalContext}
                onCheckedChange={(checked) =>
                  setGlobalSettings(prev => ({ ...prev, historicalContext: checked }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="batch">Batch Processing</Label>
                <p className="text-sm text-muted-foreground">
                  Process multiple recordings together for better insights
                </p>
              </div>
              <Switch
                id="batch"
                checked={globalSettings.batchProcessing}
                onCheckedChange={(checked) =>
                  setGlobalSettings(prev => ({ ...prev, batchProcessing: checked }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="cross-project">Cross-project Learning</Label>
                <p className="text-sm text-muted-foreground">
                  Enable insights to benefit from patterns across different projects
                </p>
              </div>
              <Switch
                id="cross-project"
                checked={globalSettings.crossProjectLearning}
                onCheckedChange={(checked) =>
                  setGlobalSettings(prev => ({ ...prev, crossProjectLearning: checked }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
