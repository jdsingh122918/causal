import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjects } from "@/contexts/ProjectsContext";
import { useRecordings } from "@/contexts/RecordingsContext";
import {
  Search,
  TestTube,
  Download,
  Database,
  FileText,
  BarChart3
} from "lucide-react";

export function ToolsPage() {
  const { projects } = useProjects();
  const { recordings } = useRecordings();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const tools = [
    {
      id: "search",
      name: "Semantic Search",
      icon: <Search className="w-6 h-6" />,
      description: "Search across all transcriptions using AI-powered semantic understanding",
      status: "Available",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    },
    {
      id: "export",
      name: "Bulk Export",
      icon: <Download className="w-6 h-6" />,
      description: "Export multiple recordings and analysis results in various formats",
      status: "Available",
      color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    },
    {
      id: "analytics",
      name: "Advanced Analytics",
      icon: <BarChart3 className="w-6 h-6" />,
      description: "Comprehensive analytics dashboard with trends and insights",
      status: "Beta",
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
    }
  ];

  const stats = {
    totalProjects: projects.length,
    totalRecordings: recordings.length,
    totalTranscriptions: recordings.filter(r => r.raw_transcript).length,
    totalAnalyses: recordings.filter(r => r.summary !== null).length
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    const mockResults = recordings
      .filter(recording =>
        recording.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recording.raw_transcript?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 10);

    setSearchResults(mockResults);
  };

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <TestTube className="w-8 h-8" />
          <div>
            <h1 className="text-3xl font-bold">Tools & Utilities</h1>
            <p className="text-muted-foreground">
              Advanced tools for managing and analyzing your transcription data
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold">{stats.totalProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Recordings</p>
                <p className="text-2xl font-bold">{stats.totalRecordings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Transcriptions</p>
                <p className="text-2xl font-bold">{stats.totalTranscriptions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Analyses</p>
                <p className="text-2xl font-bold">{stats.totalAnalyses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="search" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        {/* Semantic Search */}
        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-6 h-6" />
                Semantic Search
              </CardTitle>
              <CardDescription>
                Search across all your transcriptions using AI-powered understanding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search transcriptions, mentions, topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch}>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Search Results ({searchResults.length})</h4>
                  {searchResults.map((result, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium">{result.name}</h5>
                        <Badge variant="outline" className="text-xs">
                          {new Date(result.created_at).toLocaleDateString()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {result.raw_transcript?.substring(0, 150)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tools */}
        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-6 h-6" />
                Bulk Export
              </CardTitle>
              <CardDescription>
                Export your data in various formats
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Transcriptions</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Export all transcriptions in text format
                  </p>
                  <Button variant="outline" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as TXT
                  </Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Analysis Results</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Export intelligence analysis as structured data
                  </p>
                  <Button variant="outline" className="w-full">
                    <Database className="w-4 h-4 mr-2" />
                    Export as JSON
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Overview */}
        <TabsContent value="tools" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {tools.map((tool) => (
              <Card key={tool.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tool.color}`}>
                      {tool.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{tool.name}</CardTitle>
                        <Badge
                          variant={tool.status === 'Available' ? 'default' :
                                 tool.status === 'Beta' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {tool.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {tool.description}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={tool.status === 'Coming Soon'}
                  >
                    {tool.status === 'Coming Soon' ? 'Coming Soon' : 'Launch Tool'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}