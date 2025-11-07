import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIntelligence } from "@/contexts/IntelligenceContext";
import { useIntelligenceAnalysis } from "@/hooks/use-intelligence";
import { useTranscription } from "@/contexts/TranscriptionContext";
import type { AnalysisType, IntelligenceResult, CombinedIntelligence } from "@/contexts/IntelligenceContext";
import {
  ChevronRight,
  ChevronDown,
  Brain,
  TrendingUp,
  Heart,
  DollarSign,
  Shield,
  FileText,
  X,
  Settings,
  Activity,
  AlertTriangle,
  ArrowDown,
  Sparkles
} from "lucide-react";
import { logger } from "@/utils/logger";

interface IntelligenceSidebarProps {
  isVisible: boolean;
  onToggle: () => void;
  autoAnalyze?: boolean;
  enabledAnalyses?: AnalysisType[];
}

// Analysis type configurations with icons and colors
const ANALYSIS_CONFIG = {
  Sentiment: {
    icon: Heart,
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    label: "Sentiment"
  },
  Financial: {
    icon: DollarSign,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    label: "Financial"
  },
  Competitive: {
    icon: TrendingUp,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    label: "Competitive"
  },
  Summary: {
    icon: FileText,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    label: "Summary"
  },
  Risk: {
    icon: Shield,
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    label: "Risk"
  }
} as const;

export function IntelligenceSidebar({
  isVisible,
  onToggle,
  autoAnalyze = false,
  enabledAnalyses = ["Sentiment", "Financial", "Competitive", "Summary", "Risk"]
}: IntelligenceSidebarProps) {
  const intelligence = useIntelligence();
  const analysis = useIntelligenceAnalysis({});
  const transcription = useTranscription();

  const [expandedSections, setExpandedSections] = useState<Set<AnalysisType>>(
    new Set(["Sentiment", "Financial"])
  );
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [lastResultTimestamp, setLastResultTimestamp] = useState<string>("");

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentEndRef = useRef<HTMLDivElement>(null);

  // Auto-analysis logic
  const triggerAnalysis = useCallback(async (text: string) => {
    if (!intelligence.state.isInitialized || !autoAnalyze || !text.trim()) {
      return;
    }

    // Avoid re-analyzing the same text
    if (text === lastAnalyzedText) {
      return;
    }

    // Only analyze if text is substantial (100+ characters and ends with sentence)
    if (text.length > 100 && (text.endsWith('.') || text.endsWith('!') || text.endsWith('?'))) {
      try {
        setLastAnalyzedText(text);
        await analysis.analyzeText(text);
      } catch (error) {
        console.error("Auto-analysis failed:", error);
      }
    }
  }, [intelligence.state.isInitialized, autoAnalyze, lastAnalyzedText, analysis]);

  // Auto-scroll to latest results
  const scrollToBottom = useCallback(() => {
    if (contentEndRef.current) {
      contentEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setShowJumpToLatest(false);
    }
  }, []);

  // Handle scroll events to show/hide jump to latest button
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;
    setShowJumpToLatest(!isNearBottom && scrollHeight > clientHeight);
  }, []);

  // Auto-scroll when new results arrive
  useEffect(() => {
    const results = Array.from(intelligence.state.latestResults.values());
    if (results.length > 0) {
      const latestResult = results[results.length - 1];
      const newTimestamp = latestResult.timestamp;

      if (newTimestamp !== lastResultTimestamp) {
        setLastResultTimestamp(newTimestamp);
        // Auto-scroll to new content unless user has scrolled up
        if (!showJumpToLatest) {
          setTimeout(scrollToBottom, 100); // Small delay to allow DOM update
        }
      }
    }
  }, [intelligence.state.latestResults, lastResultTimestamp, showJumpToLatest, scrollToBottom]);

  // Update backend configuration when enabledAnalyses prop changes
  useEffect(() => {
    const currentEnabledAnalyses = intelligence.state.config.enabled_analyses;
    const propEnabledAnalyses = enabledAnalyses;

    // Check if the backend config differs from the prop
    const configDifferent = currentEnabledAnalyses.length !== propEnabledAnalyses.length ||
      !currentEnabledAnalyses.every(type => propEnabledAnalyses.includes(type)) ||
      !propEnabledAnalyses.every(type => currentEnabledAnalyses.includes(type));

    if (configDifferent && intelligence.state.config.api_key) {
      logger.debug("IntelligenceSidebar", `Updating backend config with ${propEnabledAnalyses.length} enabled analyses:`, propEnabledAnalyses);
      analysis.enableAnalysisTypes(propEnabledAnalyses).catch(error => {
        logger.error("IntelligenceSidebar", "Failed to update enabled analysis types:", error);
      });
    }
  }, [enabledAnalyses, intelligence.state.config.enabled_analyses, intelligence.state.config.api_key, analysis]);

  // Monitor enhanced transcript for auto-analysis
  useEffect(() => {
    if (!autoAnalyze || !intelligence.state.isInitialized) return;

    const enhancedText = Array.from(transcription.state.enhancedBuffers.values()).join(' ');
    if (enhancedText && enhancedText !== lastAnalyzedText) {
      triggerAnalysis(enhancedText);
    }
  }, [transcription.state.enhancedBuffers, triggerAnalysis, autoAnalyze, intelligence.state.isInitialized, lastAnalyzedText]);

  const toggleSection = (type: AnalysisType) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const getLatestResults = (): CombinedIntelligence | null => {
    const results = Array.from(intelligence.state.latestResults.values());
    return results.length > 0 ? results[results.length - 1] : null;
  };

  // Check if analysis result is new (within last 30 seconds)
  const isNewContent = useCallback((timestamp: string): boolean => {
    const resultTime = new Date(timestamp).getTime();
    const thirtySecondsAgo = Date.now() - 30 * 1000;
    return resultTime > thirtySecondsAgo;
  }, []);

  const renderAnalysisResult = (type: AnalysisType, result: IntelligenceResult, timestamp: string) => {
    const config = ANALYSIS_CONFIG[type];
    const Icon = config.icon;
    const isExpanded = expandedSections.has(type);
    const isNew = isNewContent(timestamp);

    let content = null;

    switch (type) {
      case "Sentiment":
        if (result.sentiment) {
          content = (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall:</span>
                <Badge className={config.color}>
                  {result.sentiment.overall_sentiment}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Confidence:</span>
                <span className="text-sm">{Math.round(result.sentiment.confidence * 100)}%</span>
              </div>
              {result.sentiment.key_phrases.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Key Phrases:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {result.sentiment.key_phrases.slice(0, 3).map((phrase, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }
        break;

      case "Financial":
        if (result.financial) {
          content = (
            <div className="space-y-2">
              {Object.entries(result.financial.metrics).slice(0, 3).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {key.replace('_', ' ')}:
                  </span>
                  <span className="text-sm">{value}</span>
                </div>
              ))}
              {result.financial.outlook && (
                <div>
                  <span className="text-sm font-medium">Outlook:</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.financial.outlook}
                  </p>
                </div>
              )}
            </div>
          );
        }
        break;

      case "Summary":
        if (result.summary) {
          content = (
            <div className="space-y-2">
              {result.summary.key_points.slice(0, 3).map((point, idx) => (
                <div key={idx} className="text-sm">
                  • {point}
                </div>
              ))}
              {result.summary.action_items.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Actions:</span>
                  {result.summary.action_items.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground">
                      → {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        break;

      case "Risk":
        if (result.risk) {
          const riskLevelClass =
            result.risk.overall_risk_level === "critical" ? "bg-red-600 text-white" :
            result.risk.overall_risk_level === "high" ? "bg-red-100 text-red-800" :
            result.risk.overall_risk_level === "medium" ? "bg-yellow-100 text-yellow-800" :
            "bg-green-100 text-green-800";

          content = (
            <div className="space-y-3">
              {/* Overall Risk Level */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Risk Level:</span>
                <Badge className={riskLevelClass}>
                  {result.risk.overall_risk_level.toUpperCase()}
                </Badge>
              </div>

              {/* Risk Summary */}
              {result.risk.risk_summary && (
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs text-muted-foreground italic border-l-2 border-red-300">
                  {result.risk.risk_summary}
                </div>
              )}

              {/* Promises Identified */}
              {result.risk.promises_identified.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Promises Detected</span>
                    <Badge variant="outline" className="text-xs">
                      {result.risk.promises_identified.length}
                    </Badge>
                  </div>
                  {result.risk.promises_identified.slice(0, 2).map((promise, idx) => (
                    <div key={idx} className="ml-2 mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border-l-2 border-blue-400">
                      <div className="text-xs font-medium text-blue-800 dark:text-blue-300">
                        {promise.promise_text}
                      </div>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-xs bg-white dark:bg-gray-800">
                          {promise.promise_type}
                        </Badge>
                        {promise.timeline && (
                          <Badge variant="outline" className="text-xs bg-white dark:bg-gray-800">
                            {promise.timeline}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {result.risk.promises_identified.length > 2 && (
                    <div className="text-xs text-muted-foreground ml-2">
                      +{result.risk.promises_identified.length - 2} more promises
                    </div>
                  )}
                </div>
              )}

              {/* Critical Risks */}
              {result.risk.critical_risks.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">Critical Risks</span>
                  {result.risk.critical_risks.slice(0, 2).map((risk, idx) => (
                    <div key={idx} className="text-xs text-red-800 dark:text-red-300 ml-2 mt-1">
                      🚨 {risk}
                    </div>
                  ))}
                </div>
              )}

              {/* Delivery Risks */}
              {result.risk.delivery_risks.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">Delivery Risks</span>
                  {result.risk.delivery_risks.slice(0, 1).map((dr, idx) => (
                    <div key={idx} className="ml-2 mt-1 p-2 bg-orange-50 dark:bg-orange-900/20 rounded border-l-2 border-orange-400">
                      <div className="text-xs font-medium">{dr.risk_area}</div>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {dr.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {dr.likelihood}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{dr.potential_impact}</div>
                    </div>
                  ))}
                  {result.risk.delivery_risks.length > 1 && (
                    <div className="text-xs text-muted-foreground ml-2 mt-1">
                      +{result.risk.delivery_risks.length - 1} more delivery risks
                    </div>
                  )}
                </div>
              )}

              {/* Recommended Actions */}
              {result.risk.recommended_actions.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">Recommendations</span>
                  {result.risk.recommended_actions.slice(0, 2).map((action, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground ml-2 mt-1">
                      → {action}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        break;

      case "Competitive":
        if (result.competitive) {
          content = (
            <div className="space-y-3">
              {result.competitive.competitors_mentioned.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Competitors:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {result.competitive.competitors_mentioned.slice(0, 5).map((comp, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {comp}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.competitive.industry_impact && (
                <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-md border border-blue-200 dark:border-blue-800">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Industry Impact:</span>
                  <p className="text-xs text-blue-900 dark:text-blue-200 mt-1">{result.competitive.industry_impact}</p>
                </div>
              )}

              {result.competitive.market_dynamics && (
                <div className="bg-purple-50 dark:bg-purple-950/30 p-2 rounded-md border border-purple-200 dark:border-purple-800">
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Market Dynamics:</span>
                  <p className="text-xs text-purple-900 dark:text-purple-200 mt-1">{result.competitive.market_dynamics}</p>
                </div>
              )}

              {result.competitive.competitive_moats.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Competitive Moats:</span>
                  {result.competitive.competitive_moats.slice(0, 3).map((moat, idx) => (
                    <div key={idx} className="text-sm mt-1">
                      🛡️ {moat}
                    </div>
                  ))}
                </div>
              )}

              {result.competitive.company_effects.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Company Effects:</span>
                  {result.competitive.company_effects.slice(0, 3).map((effect, idx) => (
                    <div key={idx} className="text-xs mt-1 text-muted-foreground">
                      📊 {effect}
                    </div>
                  ))}
                </div>
              )}

              {result.competitive.strategic_questions.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md border border-amber-200 dark:border-amber-800">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Strategic Questions:</span>
                  <div className="mt-1 space-y-1">
                    {result.competitive.strategic_questions.slice(0, 3).map((question, idx) => (
                      <div key={idx} className="text-xs text-amber-900 dark:text-amber-200">
                        ❓ {question}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.competitive.competitive_advantages.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Claimed Advantages:</span>
                  {result.competitive.competitive_advantages.slice(0, 2).map((advantage, idx) => (
                    <div key={idx} className="text-sm mt-1">
                      ✅ {advantage}
                    </div>
                  ))}
                </div>
              )}

              {result.competitive.threats_identified.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Threats:</span>
                  {result.competitive.threats_identified.slice(0, 2).map((threat, idx) => (
                    <div key={idx} className="text-sm mt-1 text-red-700 dark:text-red-400">
                      ⚠️ {threat}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        break;
    }

    return (
      <Collapsible
        key={type}
        open={isExpanded}
        onOpenChange={() => toggleSection(type)}
      >
        <CollapsibleTrigger asChild>
          <div className={`flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer rounded-lg relative transition-all duration-200 border ${
            isNew
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm shadow-blue-500/10'
              : 'bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-md ${config.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">{config.label}</span>
              {isNew && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                  <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">NEW</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isNew && (
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50" />
              )}
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2">
            <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 break-words">
              {content || (
                <p className="text-sm text-muted-foreground italic">No data available</p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="fixed right-4 top-20 z-50"
        title="Show Business Intelligence"
      >
        <Brain className="h-4 w-4" />
      </Button>
    );
  }

  const latestResults = getLatestResults();
  const isInitialized = intelligence.state.isInitialized;
  const isProcessing = intelligence.state.isProcessing;

  return (
    <Card className="w-[28rem] h-full flex flex-col border-l-2 border-l-blue-500/20">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/20">
              <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-lg font-semibold">Live Intelligence</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-red-600" />
          </Button>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isInitialized ? 'bg-green-500 shadow-lg shadow-green-500/30' : 'bg-gray-400'
            }`} />
            <span className="text-sm font-medium text-muted-foreground">
              {isInitialized ? 'Ready' : 'Not Initialized'}
            </span>
          </div>
          {isProcessing && (
            <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">
              <Activity className="h-3 w-3 animate-pulse text-blue-500" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Analyzing...</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 relative">
        <ScrollArea
          className="h-full px-4 py-4"
          ref={scrollAreaRef}
          onScrollCapture={handleScroll}
        >
          {!isInitialized ? (
            <div className="flex flex-col items-center justify-center h-40 text-center p-6">
              <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                <Settings className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Initialize Business Intelligence from the main dashboard to enable live analysis.
              </p>
            </div>
          ) : !latestResults ? (
            <div className="flex flex-col items-center justify-center h-40 text-center p-6">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-3">
                <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {autoAnalyze
                  ? "Start recording to see live analysis results."
                  : "Analysis results will appear here."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {enabledAnalyses.map(analysisType => {
                const result = latestResults.results[analysisType];
                return result ? renderAnalysisResult(analysisType, result, latestResults.timestamp) : (
                  <div key={analysisType} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="p-1.5 rounded-md bg-gray-200 dark:bg-gray-800">
                        {React.createElement(ANALYSIS_CONFIG[analysisType].icon, { className: "h-3.5 w-3.5" })}
                      </div>
                      <span className="text-sm font-medium">{ANALYSIS_CONFIG[analysisType].label}</span>
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 pl-8">
                      Waiting for analysis data...
                    </p>
                  </div>
                );
              })}

              {latestResults && (
                <div className="mt-6 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-700/50">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      Last analyzed at {new Date(latestResults.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Scroll anchor for auto-scroll */}
              <div ref={contentEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Jump to Latest Button */}
        {showJumpToLatest && (
          <Button
            onClick={scrollToBottom}
            size="sm"
            className="absolute bottom-4 right-4 z-10 shadow-lg shadow-blue-500/30 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 transition-all duration-200 hover:shadow-xl hover:scale-105"
          >
            <ArrowDown className="h-3 w-3 mr-1.5" />
            <span className="font-medium">Latest</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}