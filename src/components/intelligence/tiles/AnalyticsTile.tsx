import { TrendingUp } from "lucide-react";
import { IntelligenceTile } from "../IntelligenceTile";
import type { LayoutMode } from "@/hooks/intelligence/use-tile-layout";

interface AnalyticsTileProps {
  isRecording: boolean;
  layoutMode: LayoutMode;
}

export function AnalyticsTile({ isRecording, layoutMode }: AnalyticsTileProps) {
  const renderContent = () => {
    return (
      <div className="flex items-center justify-center h-full text-center p-4">
        <p className="text-sm text-muted-foreground">
          Analytics dashboard coming soon
        </p>
      </div>
    );
  };

  return (
    <IntelligenceTile
      analysisType="Summary"
      icon={TrendingUp}
      color="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
      isRecording={isRecording}
      layoutMode={layoutMode}
      showHistorical={false}
      isNew={false}
    >
      {renderContent()}
    </IntelligenceTile>
  );
}
