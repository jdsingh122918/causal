import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIntelligenceAnalysis } from "@/hooks/use-intelligence";
import type {
  CombinedIntelligence,
  SimilarAnalysis
} from "@/contexts/IntelligenceContext";
import { Search, TestTube } from "lucide-react";
import { SearchInterface } from "@/components/search/SearchInterface";
import { Badge } from "@/components/ui/badge";

export function ToolsPage() {
  const [testText, setTestText] = useState("");
  const [activeTab, setActiveTab] = useState("search");

  const analysis = useIntelligenceAnalysis({
    onSuccess: (result) => {
      console.log("Intelligence analysis completed:", result);
    },
    onError: (error) => {
      console.error("Intelligence analysis failed:", error);
    },
  });

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

  const handleSearchResultClick = (result: SimilarAnalysis) => {
    // For now, just switch to the test tab and show the content
    setTestText(result.content);
    setActiveTab("test");
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Tools</h2>
        <p className="text-muted-foreground">
          Semantic search and analysis testing utilities
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Semantic Search
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Test Analyze
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-6">
          <SearchInterface
            onResultClick={handleSearchResultClick}
            showFilters={true}
            compact={false}
          />
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
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
        </TabsContent>
      </Tabs>
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
                  <p><strong>Risk Level:</strong> {analysisResult.risk.overall_risk_level}</p>
                  <p><strong>Summary:</strong> {analysisResult.risk.risk_summary}</p>
                  {analysisResult.risk.promises_identified.length > 0 && (
                    <p><strong>Promises:</strong> {analysisResult.risk.promises_identified.length} detected</p>
                  )}
                  {analysisResult.risk.critical_risks.length > 0 && (
                    <p><strong>Critical Risks:</strong> {analysisResult.risk.critical_risks.join(", ")}</p>
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
