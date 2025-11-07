import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search,
  Database,
  AlertCircle,
  RefreshCw,
  Brain,
  ChevronDown,
  Settings2,
  Clock,
  BookOpen,
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useMongoSearch, type RecordingSearchResult, type KnowledgeSearchResult, type AnalysisContext } from "@/hooks/use-mongo-search";
import { useProjects } from "@/contexts/ProjectsContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SemanticSearchInterfaceProps {
  className?: string;
  onRecordingClick?: (recording: RecordingSearchResult) => void;
  onKnowledgeClick?: (knowledge: KnowledgeSearchResult) => void;
}

export function SemanticSearchInterface({
  className,
  onRecordingClick,
  onKnowledgeClick
}: SemanticSearchInterfaceProps) {
  const { currentProject } = useProjects();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);

  const {
    query,
    setQuery,
    recordingResults,
    knowledgeResults,
    analysisContext,
    isLoading,
    error,
    hasSearched,
    search,
    clear,
    retry,
    filters,
    setFilters,
    searchMode,
    setSearchMode,
    recentSearches,
    clearRecentSearches,
    suggestions,
    isMongoInitialized,
    initializeMongo,
  } = useMongoSearch({
    debounceMs: 500,
    autoSearch: false,
    searchMode: 'all'
  });

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    if (!isMongoInitialized) {
      toast.error("MongoDB Atlas not configured. Please set up in Settings.");
      return;
    }

    try {
      await search();
    } catch (error) {
      toast.error("Search failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  }, [query, search, isMongoInitialized]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion);
  }, [setQuery]);

  const handleRecentSearchClick = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
  }, [setQuery]);

  const formatSimilarityScore = (score: number): string => {
    return (score * 100).toFixed(1) + '%';
  };

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusIcon = () => {
    if (!isMongoInitialized) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isMongoInitialized) {
      return "MongoDB not configured";
    }
    return "MongoDB Atlas connected";
  };

  const ResultCard = ({ children, className: cardClassName, ...props }: React.ComponentProps<typeof Card>) => (
    <Card className={cn("transition-all duration-200 hover:shadow-md cursor-pointer", cardClassName)} {...props}>
      {children}
    </Card>
  );

  const RecordingResult = ({ recording }: { recording: RecordingSearchResult }) => (
    <ResultCard
      onClick={() => {
        setSelectedResult(recording.id);
        onRecordingClick?.(recording);
      }}
      className={cn(
        "mb-3",
        selectedResult === recording.id && "ring-2 ring-primary"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium line-clamp-2">
              {recording.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                Recording
              </Badge>
              <Badge variant="outline" className="text-xs">
                {formatSimilarityScore(recording.similarity_score)} match
              </Badge>
            </div>
          </div>
          <div className="text-xs text-muted-foreground ml-2">
            <Clock className="h-3 w-3 inline mr-1" />
            {formatDate(recording.created_at)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {recording.enhanced_transcript}
        </p>
        {recording.summary && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">
            Summary: {recording.summary}
          </p>
        )}
      </CardContent>
    </ResultCard>
  );

  const KnowledgeResult = ({ knowledge }: { knowledge: KnowledgeSearchResult }) => (
    <ResultCard
      onClick={() => {
        setSelectedResult(knowledge.id);
        onKnowledgeClick?.(knowledge);
      }}
      className={cn(
        "mb-3",
        selectedResult === knowledge.id && "ring-2 ring-primary"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium line-clamp-2">
              {knowledge.title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                <BookOpen className="h-3 w-3 mr-1" />
                {knowledge.content_type}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {formatSimilarityScore(knowledge.similarity_score)} match
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {knowledge.content}
        </p>
      </CardContent>
    </ResultCard>
  );

  const AnalysisContextDisplay = ({ context }: { context: AnalysisContext }) => (
    <Card className="mb-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4" />
          RAG Analysis Context
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {context.relevant_recordings.length} recordings
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {context.knowledge_entries.length} knowledge entries
          </Badge>
          <Badge variant="outline" className="text-xs">
            {context.total_context_tokens} tokens
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-3">
          {context.context_summary}
        </p>

        {context.relevant_recordings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Relevant Recordings
            </h4>
            <div className="space-y-1">
              {context.relevant_recordings.slice(0, 3).map((recording) => (
                <div key={recording.id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                  <span className="line-clamp-1">{recording.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {formatSimilarityScore(recording.similarity_score)}
                  </Badge>
                </div>
              ))}
              {context.relevant_recordings.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{context.relevant_recordings.length - 3} more recordings
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!currentProject) {
    return (
      <div className={cn("p-6", className)}>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project to use semantic search.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Semantic Search</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {getStatusIcon()}
            {getStatusText()}
          </div>
        </div>
        {!isMongoInitialized && (
          <Button
            onClick={initializeMongo}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Database className="h-3 w-3" />
            Configure MongoDB
          </Button>
        )}
      </div>

      {/* MongoDB Status Alert */}
      {!isMongoInitialized && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700">
            MongoDB Atlas is not configured. Semantic search requires MongoDB Atlas setup.{" "}
            <Button variant="link" className="h-auto p-0 text-yellow-700 underline">
              Configure in Settings
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Ask a question about your recordings..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-11"
              disabled={!isMongoInitialized}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!query.trim() || isLoading || !isMongoInitialized}
            className="gap-2 px-6"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </div>

        {/* Search Mode Tabs */}
        <Tabs value={searchMode} onValueChange={(value) => setSearchMode(value as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="recordings" className="text-xs">Recordings</TabsTrigger>
            <TabsTrigger value="knowledge" className="text-xs">Knowledge</TabsTrigger>
            <TabsTrigger value="context" className="text-xs">RAG Context</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Advanced Filters */}
        <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-8 text-sm text-muted-foreground">
              <Settings2 className="h-3 w-3" />
              Advanced Filters
              <ChevronDown className={cn("h-3 w-3 transition-transform", showAdvancedFilters && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Similarity Threshold</Label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={filters.similarity_threshold || 0.7}
                  onChange={(e) => setFilters({
                    ...filters,
                    similarity_threshold: parseFloat(e.target.value)
                  })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Max Results</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={filters.limit || 10}
                  onChange={(e) => setFilters({
                    ...filters,
                    limit: parseInt(e.target.value)
                  })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Quick Suggestions */}
      {!hasSearched && suggestions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Suggested Searches</Label>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-xs h-7"
                disabled={!isMongoInitialized}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Recent Searches</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearRecentSearches}
              className="h-6 px-2 text-xs"
            >
              Clear
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.slice(0, 3).map((recent, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => handleRecentSearchClick(recent)}
                className="text-xs h-7 text-muted-foreground"
                disabled={!isMongoInitialized}
              >
                <Clock className="h-3 w-3 mr-1" />
                {recent}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button onClick={retry} variant="outline" size="sm" className="gap-2 ml-2">
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Searching with AI semantic matching...</span>
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && !isLoading && !error && (
        <div className="space-y-4">
          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Found {recordingResults.length + knowledgeResults.length} results
              {analysisContext && ` with ${analysisContext.total_context_tokens} context tokens`}
            </span>
            {hasSearched && (
              <Button onClick={clear} variant="ghost" size="sm" className="h-6 px-2 text-xs">
                Clear Results
              </Button>
            )}
          </div>

          {/* Results Tabs */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">
                All ({recordingResults.length + knowledgeResults.length})
              </TabsTrigger>
              <TabsTrigger value="recordings">
                Recordings ({recordingResults.length})
              </TabsTrigger>
              <TabsTrigger value="knowledge">
                Knowledge ({knowledgeResults.length})
              </TabsTrigger>
              <TabsTrigger value="context">
                RAG Context {analysisContext ? '(1)' : '(0)'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {analysisContext && <AnalysisContextDisplay context={analysisContext} />}
                  {recordingResults.map((recording) => (
                    <RecordingResult key={recording.id} recording={recording} />
                  ))}
                  {knowledgeResults.map((knowledge) => (
                    <KnowledgeResult key={knowledge.id} knowledge={knowledge} />
                  ))}
                  {recordingResults.length === 0 && knowledgeResults.length === 0 && !analysisContext && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No results found for "{query}"</p>
                      <p className="text-sm">Try adjusting your search terms or filters</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="recordings" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {recordingResults.map((recording) => (
                    <RecordingResult key={recording.id} recording={recording} />
                  ))}
                  {recordingResults.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No recordings found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="knowledge" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {knowledgeResults.map((knowledge) => (
                    <KnowledgeResult key={knowledge.id} knowledge={knowledge} />
                  ))}
                  {knowledgeResults.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No knowledge entries found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="context" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {analysisContext ? (
                    <AnalysisContextDisplay context={analysisContext} />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No analysis context generated</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}