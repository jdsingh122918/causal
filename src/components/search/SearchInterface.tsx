import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Search, AlertCircle, RefreshCw, History, Zap } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { SearchResults } from "./SearchResults";
import { SearchFilters } from "./SearchFilters";
import { useSearch } from "@/hooks/use-search";
import { useProjects } from "@/contexts/ProjectsContext";
import type { SimilarAnalysis } from "@/contexts/IntelligenceContext";

interface SearchInterfaceProps {
  className?: string;
  compact?: boolean;
  showFilters?: boolean;
  onResultClick?: (result: SimilarAnalysis) => void;
}

export function SearchInterface({
  className,
  compact = false,
  showFilters = true,
  onResultClick
}: SearchInterfaceProps) {
  const { currentProject } = useProjects();
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    hasSearched,
    search,
    clear,
    retry,
    filters,
    setFilters,
    recentSearches,
    clearRecentSearches,
    suggestions
  } = useSearch({
    debounceMs: 300,
    maxRecentSearches: 10,
    autoSearch: false
  });

  if (!currentProject) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Search Analysis History</h3>
          <p className="text-muted-foreground">
            Select a project to search through your analysis history with natural language
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSearch = async (searchQuery: string) => {
    await search(searchQuery);
  };

  const handleFiltersChange = async (newFilters: typeof filters) => {
    setFilters(newFilters);
    if (hasSearched && query.trim()) {
      await search(query, newFilters);
    }
  };

  return (
    <Card className={className}>
      {!compact && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Semantic Search
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Search through your analysis history using natural language
              </p>
            </div>
            {currentProject && (
              <Badge variant="outline" className="text-sm">
                {currentProject.name}
              </Badge>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-6">
        {/* Search Bar and Controls */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <SearchBar
                value={query}
                onSearch={handleSearch}
                onClear={clear}
                isLoading={isLoading}
                suggestions={suggestions}
                recentSearches={recentSearches}
                placeholder="e.g., 'financial risks mentioned in recent meetings'"
              />
            </div>
            {showFilters && (
              <SearchFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                resultCount={results.length}
                isOpen={showFiltersPanel}
                onOpenChange={setShowFiltersPanel}
              />
            )}
          </div>

          {/* Search Status and Actions */}
          {(hasSearched || error) && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {hasSearched && !error && (
                  <Badge variant="secondary" className="text-sm">
                    {results.length} result{results.length !== 1 ? 's' : ''} found
                  </Badge>
                )}
                {error && (
                  <Badge variant="destructive" className="text-sm">
                    Search failed
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {recentSearches.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearRecentSearches}
                    className="text-xs"
                  >
                    <History className="h-3 w-3 mr-1" />
                    Clear History
                  </Button>
                )}
                {error && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={retry}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button
                variant="ghost"
                size="sm"
                onClick={retry}
                className="ml-2"
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Search Suggestions (when no search has been performed) */}
        {!hasSearched && !query.trim() && (
          <div className="space-y-4">
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Try searching for:
              </h4>
              <div className="grid gap-2">
                {suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQuery(suggestion);
                      handleSearch(suggestion);
                    }}
                    className="justify-start text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Search className="h-3 w-3 mr-2" />
                    "{suggestion}"
                  </Button>
                ))}
              </div>
            </div>

            {recentSearches.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Recent Searches:
                  </h4>
                  <div className="grid gap-2">
                    {recentSearches.slice(0, 5).map((recentQuery, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setQuery(recentQuery);
                          handleSearch(recentQuery);
                        }}
                        className="justify-start text-sm text-muted-foreground hover:text-foreground"
                      >
                        <History className="h-3 w-3 mr-2" />
                        "{recentQuery}"
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Search Results */}
        {(hasSearched || isLoading) && (
          <>
            <Separator />
            <SearchResults
              results={results}
              query={query}
              isLoading={isLoading}
              onResultClick={onResultClick}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}