// React import not needed for this component
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import type { AnalysisType } from "@/contexts/IntelligenceContext";

interface TileControlsProps {
  analysisType: AnalysisType;
  isRecording: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRefresh?: () => void;
}

export function TileControls({
  analysisType: _analysisType,
  isRecording: _isRecording,
  isExpanded,
  onToggleExpand,
  onRefresh
}: TileControlsProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Refresh button */}
      {onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="h-7 w-7 p-0"
          title="Refresh analysis"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}

      {/* Expand/Collapse button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleExpand}
        className="h-7 w-7 p-0"
        title={isExpanded ? "Collapse" : "Expand"}
      >
        {isExpanded ? (
          <Minimize2 className="h-3 w-3" />
        ) : (
          <Maximize2 className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}
