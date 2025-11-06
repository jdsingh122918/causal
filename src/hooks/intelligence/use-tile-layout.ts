import { useState, useEffect, useMemo } from "react";

export type LayoutMode = "compact" | "expanded" | "full-screen";

interface UseTileLayoutOptions {
  isRecording: boolean;
  initialMode?: LayoutMode;
}

interface UseTileLayoutReturn {
  layoutMode: LayoutMode;
  gridClasses: string;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleLayout: () => void;
}

/**
 * Hook for managing tile-based layout with responsive grid system
 */
export function useTileLayout({
  isRecording,
  initialMode = "expanded",
}: UseTileLayoutOptions): UseTileLayoutReturn {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialMode);

  // Auto-adjust layout based on recording state
  useEffect(() => {
    if (isRecording && layoutMode !== "compact") {
      setLayoutMode("compact");
    } else if (!isRecording && layoutMode === "compact") {
      setLayoutMode("expanded");
    }
  }, [isRecording, layoutMode]);

  // Generate responsive grid classes based on layout mode
  const gridClasses = useMemo(() => {
    const baseClasses =
      "grid w-full h-fit transition-all duration-300 ease-in-out";

    switch (layoutMode) {
      case "compact":
        // During recording - tighter spacing, 2 columns on larger screens
        return `${baseClasses} gap-2 grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2`;

      case "expanded":
        // Normal view - balanced spacing, 2-3 columns
        return `${baseClasses} gap-4 grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3`;

      case "full-screen":
        // Analytics focus - maximum columns
        return `${baseClasses} gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`;

      default:
        return `${baseClasses} gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-2`;
    }
  }, [layoutMode]);

  // Toggle through layout modes
  const toggleLayout = () => {
    setLayoutMode((prev) => {
      switch (prev) {
        case "compact":
          return "expanded";
        case "expanded":
          return "full-screen";
        case "full-screen":
          return "compact";
        default:
          return "expanded";
      }
    });
  };

  return {
    layoutMode,
    gridClasses,
    setLayoutMode,
    toggleLayout,
  };
}
