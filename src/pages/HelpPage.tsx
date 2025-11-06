import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mic,
  Brain,
  FolderOpen,
  Settings,
  Search,
  TrendingUp,
  Play,
  Pause,
  Save,
  Eye,
  Zap,
  Shield,
  Database,
  MessageSquare,
  BarChart3,
  Users,
  DollarSign,
  AlertTriangle,
  FileText,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

export function HelpPage() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const features = [
    {
      id: "transcription",
      icon: <Mic className="h-5 w-5" />,
      title: "Real-Time Transcription",
      description: "High-quality audio capture and transcription",
      color: "bg-blue-100 dark:bg-blue-900",
    },
    {
      id: "intelligence",
      icon: <Brain className="h-5 w-5" />,
      title: "AI Intelligence Analysis",
      description: "Multi-agent analysis with 5 specialized AI agents",
      color: "bg-purple-100 dark:bg-purple-900",
    },
    {
      id: "projects",
      icon: <FolderOpen className="h-5 w-5" />,
      title: "Multi-Project Management",
      description: "Organize recordings into projects with custom settings",
      color: "bg-green-100 dark:bg-green-900",
    },
    {
      id: "search",
      icon: <Search className="h-5 w-5" />,
      title: "Semantic Search & Vector DB",
      description: "Find relevant past analyses using natural language",
      color: "bg-yellow-100 dark:bg-yellow-900",
    },
  ];

  const analysisTypes = [
    {
      type: "Sentiment",
      icon: <MessageSquare className="h-4 w-4" />,
      color: "border-l-pink-500",
      description: "Analyzes emotional tone, confidence levels, and key phrases from conversations",
    },
    {
      type: "Financial",
      icon: <DollarSign className="h-4 w-4" />,
      color: "border-l-green-500",
      description: "Identifies financial metrics, currencies, percentages, and business terminology",
    },
    {
      type: "Competitive",
      icon: <Users className="h-4 w-4" />,
      color: "border-l-blue-500",
      description: "Detects competitor mentions, market dynamics, advantages, and threats",
    },
    {
      type: "Summary",
      icon: <FileText className="h-4 w-4" />,
      color: "border-l-purple-500",
      description: "Extracts key points, action items, decisions, and business impact",
    },
    {
      type: "Risk",
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "border-l-red-500",
      description: "Identifies risk levels, promises made, delivery risks, and mitigation strategies",
    },
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Causal Help Center</h1>
        <p className="text-lg text-muted-foreground">
          Learn how to use Causal's powerful AI-powered transcription and business intelligence features
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
          <TabsTrigger value="transcription">Transcription</TabsTrigger>
          <TabsTrigger value="intelligence">AI Analysis</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Features</TabsTrigger>
          <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                What is Causal?
              </CardTitle>
              <CardDescription>
                Causal is a sophisticated AI-powered desktop application that transforms conversations into actionable business intelligence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="font-semibold">Key Capabilities:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-blue-500" />
                      Real-time transcription using AssemblyAI
                    </li>
                    <li className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      5 specialized AI agents for analysis
                    </li>
                    <li className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-green-500" />
                      Local vector embeddings for semantic search
                    </li>
                    <li className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-orange-500" />
                      100% privacy-first with local processing
                    </li>
                    <li className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      Historical analysis and trend tracking
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold">Perfect For:</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Business meetings and client calls</li>
                    <li>• Product feedback sessions</li>
                    <li>• Interview transcription and analysis</li>
                    <li>• Market research conversations</li>
                    <li>• Strategic planning discussions</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card
                key={feature.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  activeFeature === feature.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setActiveFeature(activeFeature === feature.id ? null : feature.id)}
              >
                <CardHeader className="pb-3">
                  <div className={`w-10 h-10 rounded-lg ${feature.color} flex items-center justify-center mb-2`}>
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                {activeFeature === feature.id && (
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      Learn More <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="getting-started" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Start Guide</CardTitle>
              <CardDescription>
                Get up and running with Causal in just a few steps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold">Configure API Keys</h3>
                    <p className="text-sm text-muted-foreground">
                      Go to Settings and add your AssemblyAI API key for transcription and Anthropic API key for AI analysis.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2">
                      <Settings className="h-4 w-4 mr-2" />
                      Go to Settings
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold">Create Your First Project</h3>
                    <p className="text-sm text-muted-foreground">
                      Projects help organize your recordings by topic, client, or purpose. Click the + button in the sidebar.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Create Project
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold">Enable AI Intelligence</h3>
                    <p className="text-sm text-muted-foreground">
                      Click the gear icon next to your project name and enable Business Intelligence for real-time analysis.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold">Start Recording</h3>
                    <p className="text-sm text-muted-foreground">
                      Select your audio device and click the record button. Watch as AI provides real-time insights!
                    </p>
                    <Button size="sm" className="mt-2">
                      <Mic className="h-4 w-4 mr-2" />
                      Start Recording
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcription" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Recording Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Play className="h-4 w-4 text-green-500" />
                    <div>
                      <strong>Start Recording:</strong> Click the record button to begin audio capture
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Pause className="h-4 w-4 text-yellow-500" />
                    <div>
                      <strong>Pause/Resume:</strong> Pause recording without ending the session
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Save className="h-4 w-4 text-blue-500" />
                    <div>
                      <strong>Stop & Save:</strong> End recording and automatically save with AI analysis
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audio Quality Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>• Use a high-quality microphone for best results</li>
                  <li>• Ensure stable internet connection for real-time processing</li>
                  <li>• Minimize background noise when possible</li>
                  <li>• Speak clearly and at a moderate pace</li>
                  <li>• Test audio levels before important recordings</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transcript Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <h3 className="font-semibold mb-2">Real-Time Display</h3>
                  <p className="text-sm text-muted-foreground">
                    See transcription appear in real-time as you speak, with automatic punctuation and formatting.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Enhanced Transcript</h3>
                  <p className="text-sm text-muted-foreground">
                    AI-enhanced version with improved grammar, structure, and clarity for professional use.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Export Options</h3>
                  <p className="text-sm text-muted-foreground">
                    Export transcripts in multiple formats including text, markdown, and structured reports.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intelligence" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Analysis Agents
              </CardTitle>
              <CardDescription>
                Causal features 5 specialized AI agents that analyze your conversations in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysisTypes.map((analysis) => (
                  <div key={analysis.type} className={`border-l-4 ${analysis.color} pl-4 py-2`}>
                    <div className="flex items-center gap-2 mb-1">
                      {analysis.icon}
                      <h3 className="font-semibold">{analysis.type} Analysis</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{analysis.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Intelligence Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium">Analysis Frequency</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose when AI analyzes: after each sentence, paragraph, or manually
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Agent Selection</h4>
                  <p className="text-sm text-muted-foreground">
                    Enable specific analysis types based on your conversation needs
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Auto-Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatic analysis triggers based on content volume and context
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Historical Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium">Similar Past Analyses</h4>
                  <p className="text-sm text-muted-foreground">
                    Each analysis tile shows relevant historical context from similar conversations
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Learning System</h4>
                  <p className="text-sm text-muted-foreground">
                    AI improves over time by learning patterns from your conversation history
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Trend Tracking</h4>
                  <p className="text-sm text-muted-foreground">
                    Monitor changes in sentiment, financial metrics, and other key indicators
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Vector Database & Search
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium">Semantic Search</h4>
                  <p className="text-sm text-muted-foreground">
                    Find relevant conversations using natural language queries like "financial risks mentioned in recent meetings"
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Local Processing</h4>
                  <p className="text-sm text-muted-foreground">
                    All vector embeddings processed locally using ONNX for complete privacy
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Similarity Scoring</h4>
                  <p className="text-sm text-muted-foreground">
                    Advanced similarity algorithms help surface the most relevant historical content
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Analytics Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium">Trend Visualization</h4>
                  <p className="text-sm text-muted-foreground">
                    View sentiment trends, financial metrics, and competitive analysis over time
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Performance Metrics</h4>
                  <p className="text-sm text-muted-foreground">
                    Track analysis confidence, processing times, and system performance
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Custom Reports</h4>
                  <p className="text-sm text-muted-foreground">
                    Generate comprehensive reports combining transcription and analysis data
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <h4 className="font-medium mb-2">Local Processing</h4>
                  <p className="text-sm text-muted-foreground">
                    Vector embeddings and similarity search run entirely on your device
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Encrypted Storage</h4>
                  <p className="text-sm text-muted-foreground">
                    API keys stored with enterprise-grade encryption (ChaCha20Poly1305)
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">No Data Sharing</h4>
                  <p className="text-sm text-muted-foreground">
                    Your conversations and analysis results never leave your device
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Multi-Project Organization</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Organize recordings by client, topic, or purpose with independent settings
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h5 className="font-medium text-sm">Project Features:</h5>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                      <li>• Custom intelligence configuration per project</li>
                      <li>• Independent analysis history</li>
                      <li>• Project-specific export settings</li>
                      <li>• Organized recording history</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-sm">Management Actions:</h5>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                      <li>• Create/delete/rename projects</li>
                      <li>• Configure AI analysis per project</li>
                      <li>• Export project summaries</li>
                      <li>• Cross-project search and comparison</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="troubleshooting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Common Issues & Solutions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Audio & Recording Issues</h3>
                  <div className="space-y-3">
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm">No audio input detected</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Check microphone permissions in system settings and ensure correct device is selected
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm">Poor transcription quality</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ensure stable internet, minimize background noise, and check audio input levels
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm">Recording automatically stops</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Check AssemblyAI API key validity and account credits
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">AI Analysis Issues</h3>
                  <div className="space-y-3">
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm">AI analysis not working</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Verify Anthropic API key in settings and ensure project has intelligence enabled
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm">Analysis taking too long</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Large text buffers may take time. Try adjusting analysis frequency to "sentence" mode
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm">Inconsistent analysis results</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        AI analysis improves with more data. Ensure sufficient content for meaningful analysis
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Performance & Storage</h3>
                  <div className="space-y-3">
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm">App running slowly</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Large vector databases can impact performance. Consider archiving old projects
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm">Search not finding results</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Vector embeddings may need time to initialize. Check embeddings status in diagnostics
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Getting Support</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Diagnostics & Logs</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Use the Diagnostics panel to view system logs and performance metrics
                  </p>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    View Diagnostics
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-2">System Information</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Check system status including API connectivity and embedding service health
                  </p>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    System Status
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}