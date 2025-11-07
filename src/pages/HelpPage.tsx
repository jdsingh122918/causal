import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  Brain,
  Settings,
  Play,
  Key,
  Folder,
  HelpCircle,
  ExternalLink
} from "lucide-react";

export function HelpPage() {
  const features = [
    {
      icon: <Mic className="w-6 h-6" />,
      title: "Real-time Transcription",
      description: "Record audio and get instant transcription powered by AssemblyAI",
      steps: ["Select audio device in Settings", "Click record button", "Speak naturally", "View live transcription"]
    },
    {
      icon: <Brain className="w-6 h-6" />,
      title: "AI Intelligence Analysis",
      description: "Automatic analysis with 5 specialized agents",
      steps: ["Enable intelligence in project settings", "Record or import transcript", "View sentiment, financial, competitive, summary, and risk analysis", "Export insights"]
    },
    {
      icon: <Folder className="w-6 h-6" />,
      title: "Project Organization",
      description: "Organize recordings by projects for better management",
      steps: ["Create new project", "Select project before recording", "View project history", "Export project data"]
    }
  ];

  const quickStart = [
    { step: 1, title: "Setup API Keys", icon: <Key className="w-5 h-5" />, description: "Go to Settings → Add your AssemblyAI and Claude API keys" },
    { step: 2, title: "Create Project", icon: <Folder className="w-5 h-5" />, description: "Click '+' in sidebar → Create a new project" },
    { step: 3, title: "Configure Audio", icon: <Mic className="w-5 h-5" />, description: "Settings → Select your microphone device" },
    { step: 4, title: "Start Recording", icon: <Play className="w-5 h-5" />, description: "Click record button → Speak → Get real-time transcription" }
  ];

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Causal Help Center</h1>
        <p className="text-xl text-muted-foreground">
          AI-powered transcription and intelligence analysis platform
        </p>
        <div className="flex justify-center gap-2 flex-wrap">
          <Badge variant="secondary">Real-time Transcription</Badge>
          <Badge variant="secondary">AI Analysis</Badge>
          <Badge variant="secondary">Project Management</Badge>
        </div>
      </div>

      {/* Quick Start Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-6 h-6" />
            Quick Start Guide
          </CardTitle>
          <CardDescription>
            Get started with Causal in 4 simple steps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickStart.map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center p-4 rounded-lg border">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground mb-3">
                  {item.icon}
                </div>
                <h3 className="font-semibold mb-2">Step {item.step}: {item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Features Overview</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  {feature.icon}
                  {feature.title}
                </CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {feature.steps.map((step, stepIndex) => (
                    <div key={stepIndex} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      {step}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Need More Help?</CardTitle>
          <CardDescription>
            Get support and additional resources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              For technical support, feature requests, or bug reports
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Documentation
              </Button>
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Support
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}