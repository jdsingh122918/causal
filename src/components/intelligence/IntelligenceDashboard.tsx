import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useIntelligenceAnalysis, useIntelligenceStatus } from "@/hooks/use-intelligence";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import type {
  AnalysisType,
  CombinedIntelligence
} from "@/contexts/IntelligenceContext";
import { Brain, Settings, TestTube, Activity, AlertCircle, CheckCircle } from "lucide-react";

export function IntelligenceDashboard() {
  const [testText, setTestText] = useState("");
  const [apiKey, setApiKey] = useState("");

  const intelligence = useIntelligence();
  const analysis = useIntelligenceAnalysis({
    onSuccess: (result) => {
      console.log("Intelligence analysis completed:", result);
    },
    onError: (error) => {
      console.error("Intelligence analysis failed:", error);
    },
  });

  const status = useIntelligenceStatus();

  // Load API key on mount
  useEffect(() => {
    setApiKey(intelligence.state.config.api_key);
  }, [intelligence.state.config.api_key]);

  const handleInitialize = async () => {
    if (!apiKey.trim()) {
      alert("Please enter an API key first");
      return;
    }

    try {
      await analysis.updateApiKey(apiKey);
      await analysis.initialize();
    } catch (error) {
      console.error("Failed to initialize:", error);
    }
  };

  const handleTestAnalysis = async () => {
    if (!testText.trim()) {
      alert("Please enter some text to analyze");
      return;
    }

    try {
      await analysis.analyzeText(testText);
    } catch (error) {
      console.error("Analysis failed:", error);
    }
  };

  const handleTestConnection = async () => {
    try {
      const isConnected = await analysis.testConnection();
      alert(isConnected ? "Connection successful!" : "Connection failed");
    } catch (error) {
      alert("Connection test failed");
    }
  };

  const toggleAnalysisType = async (analysisType: AnalysisType) => {
    const currentTypes = intelligence.state.config.enabled_analyses;
    const newTypes = currentTypes.includes(analysisType)
      ? currentTypes.filter(type => type !== analysisType)
      : [...currentTypes, analysisType];

    try {
      await analysis.enableAnalysisTypes(newTypes);
    } catch (error) {
      console.error("Failed to update analysis types:", error);
    }
  };

  const getStatusColor = () => {
    if (!status.status.hasApiKey) return "text-red-500";
    if (!status.status.isInitialized) return "text-yellow-500";
    if (status.status.isRunning) return "text-green-500";
    return "text-gray-500";
  };

  const getStatusText = () => {
    if (!status.status.hasApiKey) return "No API Key";
    if (!status.status.isInitialized) return "Not Initialized";
    if (status.status.isRunning) return "Running";
    return "Inactive";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Business Intelligence
          </h2>
          <p className="text-muted-foreground">
            AI-powered analysis for real-time business insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Activity className={`h-5 w-5 ${getStatusColor()}`} />
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* System Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Status & Configuration
          </CardTitle>
          <CardDescription>
            Configure and monitor the intelligence system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="flex items-center gap-2">
                {status.status.isRunning ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">{getStatusText()}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Agents</Label>
              <p className="text-sm font-mono">{status.status.agentCount}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Model</Label>
              <p className="text-sm font-mono">{status.status.model}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">API Key</Label>
              <p className="text-sm">
                {status.status.hasApiKey ? "Configured" : "Missing"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">Anthropic API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleInitialize}
                  disabled={analysis.isProcessing || !apiKey.trim()}
                >
                  Initialize
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={!apiKey.trim()}
                >
                  Test
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Enabled Analysis Types</Label>
              <div className="flex flex-wrap gap-2">
                {intelligence.state.availableAnalysisTypes.map((type) => (
                  <Badge
                    key={type.type}
                    variant={
                      intelligence.state.config.enabled_analyses.includes(type.type as AnalysisType)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => toggleAnalysisType(type.type as AnalysisType)}
                  >
                    {type.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Analysis Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Test Analysis
          </CardTitle>
          <CardDescription>
            Test the intelligence system with sample text
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-text">Sample Text</Label>
            <textarea
              id="test-text"
              placeholder="Enter text to analyze... (e.g., 'Our Q3 revenue increased 15% to $50M, driven by strong performance in our core products. We remain optimistic about market conditions despite competitive pressures from Apple and Google.')"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full min-h-[100px] px-3 py-2 border border-input bg-background rounded-md resize-y"
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {analysis.processingStats.totalAnalyses > 0 && (
                <span>
                  Analyses: {analysis.processingStats.successfulAnalyses}/{analysis.processingStats.totalAnalyses}
                  {analysis.processingStats.averageProcessingTime > 0 && (
                    <span> • Avg: {analysis.processingStats.averageProcessingTime}ms</span>
                  )}
                </span>
              )}
            </div>
            <Button
              onClick={handleTestAnalysis}
              disabled={!analysis.isReady || analysis.isProcessing || !testText.trim()}
            >
              {analysis.isProcessing ? "Analyzing..." : "Analyze"}
            </Button>
          </div>

          {analysis.lastError && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{analysis.lastError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Display */}
      {analysis.latestResult && (
        <IntelligenceResults result={analysis.latestResult} />
      )}

      {/* Processing Stats */}
      {analysis.processingStats.totalAnalyses > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{analysis.processingStats.totalAnalyses}</p>
                <p className="text-sm text-muted-foreground">Total Analyses</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">
                  {analysis.processingStats.successfulAnalyses}
                </p>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {analysis.processingStats.averageProcessingTime}ms
                </p>
                <p className="text-sm text-muted-foreground">Avg Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface IntelligenceResultsProps {
  result: CombinedIntelligence;
}

function IntelligenceResults({ result }: IntelligenceResultsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Results</CardTitle>
        <CardDescription>
          Buffer #{result.buffer_id} • {new Date(result.timestamp).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(result.results).map(([analysisType, analysisResult]) => (
          <div key={analysisType} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{analysisType}</Badge>
              <span className="text-sm text-muted-foreground">
                {analysisResult.processing_time_ms}ms
              </span>
            </div>

            <div className="pl-4 border-l-2 border-muted space-y-2">
              {analysisResult.sentiment && (
                <div>
                  <p><strong>Sentiment:</strong> {analysisResult.sentiment.overall_sentiment}</p>
                  <p><strong>Confidence:</strong> {(analysisResult.sentiment.confidence * 100).toFixed(1)}%</p>
                  {analysisResult.sentiment.key_phrases.length > 0 && (
                    <p><strong>Key Phrases:</strong> {analysisResult.sentiment.key_phrases.join(", ")}</p>
                  )}
                </div>
              )}

              {analysisResult.financial && (
                <div>
                  {Object.keys(analysisResult.financial.metrics).length > 0 && (
                    <p><strong>Metrics:</strong> {JSON.stringify(analysisResult.financial.metrics)}</p>
                  )}
                  {analysisResult.financial.financial_terms.length > 0 && (
                    <p><strong>Financial Terms:</strong> {analysisResult.financial.financial_terms.join(", ")}</p>
                  )}
                </div>
              )}

              {analysisResult.competitive && (
                <div>
                  {analysisResult.competitive.competitors_mentioned.length > 0 && (
                    <p><strong>Competitors:</strong> {analysisResult.competitive.competitors_mentioned.join(", ")}</p>
                  )}
                  {analysisResult.competitive.competitive_advantages.length > 0 && (
                    <p><strong>Advantages:</strong> {analysisResult.competitive.competitive_advantages.join(", ")}</p>
                  )}
                </div>
              )}

              {analysisResult.summary && (
                <div>
                  {analysisResult.summary.key_points.length > 0 && (
                    <div>
                      <p><strong>Key Points:</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        {analysisResult.summary.key_points.map((point, idx) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {analysisResult.risk && (
                <div>
                  <p><strong>Risk Level:</strong> {analysisResult.risk.risk_level}</p>
                  {analysisResult.risk.risks_identified.length > 0 && (
                    <p><strong>Risks:</strong> {analysisResult.risk.risks_identified.join(", ")}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}