import React, { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import type { AnalysisType } from "@/contexts/IntelligenceContext";
import type { LayoutMode } from "@/hooks/intelligence/use-tile-layout";
import { TileControls } from "./components/TileControls";

interface IntelligenceTileProps {
  analysisType: AnalysisType;
  icon: React.ElementType;
  color: string;
  isRecording: boolean;
  layoutMode: LayoutMode;
  showHistorical?: boolean;
  children: ReactNode;
  historicalContent?: ReactNode;
  isNew?: boolean;
  timestamp?: string;
}

export function IntelligenceTile({
  analysisType,
  icon: Icon,
  color,
  isRecording,
  layoutMode,
  showHistorical = false,
  children,
  historicalContent,
  isNew = false,
  timestamp
}: IntelligenceTileProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);

  // Determine tile height based on layout mode
  const tileHeight = layoutMode === "compact"
    ? "min-h-[180px] max-h-[280px]"
    : layoutMode === "expanded"
    ? "min-h-[220px] max-h-[400px]"
    : "min-h-[260px] max-h-[500px]";

  // Color-coded border based on analysis type
  const borderColor = {
    Sentiment: "border-l-pink-500",
    Financial: "border-l-green-500",
    Competitive: "border-l-blue-500",
    Summary: "border-l-purple-500",
    Risk: "border-l-red-500"
  }[analysisType] || "border-l-gray-500";

  return (
    <Card
      className={`
        ${tileHeight}
        ${borderColor}
        border-l-4
        flex
        flex-col
        transition-all
        duration-300
        hover:shadow-lg
        ${isNew ? 'ring-2 ring-blue-400 ring-offset-2 shadow-blue-500/20' : ''}
        ${isRecording ? 'border-dashed' : ''}
      `}
    >
      <CardHeader className="pb-3 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold">{analysisType}</CardTitle>
            {isNew && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">NEW</span>
              </div>
            )}
          </div>
          <TileControls
            analysisType={analysisType}
            isRecording={isRecording}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
          />
        </div>
        {timestamp && (
          <p className="text-xs text-muted-foreground mt-1">
            Last updated: {new Date(timestamp).toLocaleTimeString()}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col">
        {/* Main Analysis Content */}
        <div className={`flex-1 overflow-y-auto ${layoutMode === "compact" ? 'space-y-2' : 'space-y-3'}`}>
          {children}
        </div>

        {/* Historical Context Section */}
        {showHistorical && historicalContent && (
          <Collapsible
            open={showHistory}
            onOpenChange={setShowHistory}
            className="mt-3 pt-3 border-t border-border"
          >
            <CollapsibleTrigger className="flex items-center gap-2 hover:text-foreground text-muted-foreground transition-colors">
              {showHistory ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Badge variant="outline" className="text-xs">
                Similar Past Analyses
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              {historicalContent}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
