import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Filter,
  Calendar,
  Layers,
  Target,
  Hash,
  RotateCcw,
  Heart,
  DollarSign,
  Users,
  FileText,
  AlertTriangle
} from "lucide-react";
import type { SearchFilters as SearchFiltersType, AnalysisType } from "@/contexts/IntelligenceContext";

interface SearchFiltersProps {
  filters: SearchFiltersType;
  onFiltersChange: (filters: SearchFiltersType) => void;
  resultCount?: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SearchFilters({
  filters,
  onFiltersChange,
  resultCount,
  isOpen = false,
  onOpenChange
}: SearchFiltersProps) {
  const [localFilters, setLocalFilters] = useState<SearchFiltersType>(filters);

  const analysisTypes: { value: AnalysisType; label: string; icon: any }[] = [
    { value: "Sentiment", label: "Sentiment", icon: Heart },
    { value: "Financial", label: "Financial", icon: DollarSign },
    { value: "Competitive", label: "Competitive", icon: Users },
    { value: "Summary", label: "Summary", icon: FileText },
    { value: "Risk", label: "Risk", icon: AlertTriangle },
  ];

  const dateRangeOptions = [
    { value: "1d", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 3 months" },
    { value: "1y", label: "Last year" },
    { value: "all", label: "All time" },
  ];

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.analysis_types && filters.analysis_types.length > 0) count++;
    if (filters.date_range) count++;
    if (filters.min_similarity && filters.min_similarity > 0.5) count++;
    if (filters.top_k && filters.top_k !== 10) count++;
    return count;
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    onOpenChange?.(false);
  };

  const resetFilters = () => {
    const resetFilters: SearchFiltersType = {
      project_id: filters.project_id, // Keep project_id
      analysis_types: undefined,
      date_range: undefined,
      top_k: 10,
      min_similarity: 0.5
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const updateFilters = (updates: Partial<SearchFiltersType>) => {
    setLocalFilters(prev => ({ ...prev, ...updates }));
  };

  const toggleAnalysisType = (type: AnalysisType) => {
    const current = localFilters.analysis_types || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    updateFilters({ analysis_types: updated.length > 0 ? updated : undefined });
  };

  const setDateRange = (range: string) => {
    if (range === "all") {
      updateFilters({ date_range: undefined });
      return;
    }

    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    let startTime = now;

    switch (range) {
      case "1d":
        startTime = now - msInDay;
        break;
      case "7d":
        startTime = now - 7 * msInDay;
        break;
      case "30d":
        startTime = now - 30 * msInDay;
        break;
      case "90d":
        startTime = now - 90 * msInDay;
        break;
      case "1y":
        startTime = now - 365 * msInDay;
        break;
    }

    updateFilters({
      date_range: {
        start_timestamp: Math.floor(startTime / 1000),
        end_timestamp: Math.floor(now / 1000)
      }
    });
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Search Filters</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>

          <Separator />

          {/* Analysis Types */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Analysis Types</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {analysisTypes.map((type) => {
                const isSelected = localFilters.analysis_types?.includes(type.value) || false;
                const Icon = type.icon;

                return (
                  <Button
                    key={type.value}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAnalysisType(type.value)}
                    className="justify-start gap-2 h-8"
                  >
                    <Icon className="h-3 w-3" />
                    <span className="text-xs">{type.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Date Range</span>
            </div>
            <Select
              value={localFilters.date_range ? "custom" : "all"}
              onValueChange={setDateRange}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                {dateRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Similarity Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Min Similarity</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {Math.round((localFilters.min_similarity || 0.5) * 100)}%
              </Badge>
            </div>
            <Slider
              value={[(localFilters.min_similarity || 0.5) * 100]}
              onValueChange={([value]: number[]) => updateFilters({ min_similarity: value / 100 })}
              max={100}
              min={0}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          <Separator />

          {/* Result Limit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Max Results</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {localFilters.top_k || 10}
              </Badge>
            </div>
            <Slider
              value={[localFilters.top_k || 10]}
              onValueChange={([value]: number[]) => updateFilters({ top_k: value })}
              max={50}
              min={5}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5</span>
              <span>50</span>
            </div>
          </div>

          <Separator />

          {/* Apply/Cancel Buttons */}
          <div className="flex gap-2">
            <Button onClick={applyFilters} size="sm" className="flex-1">
              Apply Filters
              {resultCount !== undefined && (
                <Badge variant="secondary" className="ml-2">
                  {resultCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}