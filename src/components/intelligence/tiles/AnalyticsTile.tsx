import { TrendingUp } from "lucide-react";
import { IntelligenceTile } from "../IntelligenceTile";
import { AnalyticsOverview } from "@/components/analytics/AnalyticsOverview";
import type { LayoutMode } from "@/hooks/intelligence/use-tile-layout";

interface AnalyticsTileProps {
  isRecording: boolean;
  layoutMode: LayoutMode;
}

export function AnalyticsTile({ isRecording, layoutMode }: AnalyticsTileProps) {
  const renderContent = () => {
    return (
      <div className="p-4 h-full overflow-y-auto">
        <AnalyticsOverview />
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
