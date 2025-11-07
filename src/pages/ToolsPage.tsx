import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjects } from "@/contexts/ProjectsContext";
import { useRecordings } from "@/contexts/RecordingsContext";
import { SemanticSearchInterface } from "@/components/search/SemanticSearchInterface";
import { MigrationProgressDialog } from "@/components/migration/MigrationProgressDialog";
import {
  TestTube,
  Download,
  Database,
  FileText,
  BarChart3,
  ArrowUpRight,
  Zap,
  Brain,
  Upload
} from "lucide-react";

export function ToolsPage() {
  const { projects } = useProjects();
  const { recordings } = useRecordings();
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false);

  const tools = [
    {
      id: "semantic-search",
      name: "AI Semantic Search",
      icon: <Brain className="w-6 h-6" />,
      description: "Search across recordings using MongoDB Atlas Vector Search with VoyageAI embeddings",
      status: "Available",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      action: () => {} // Navigate to search tab
    },
    {
      id: "mongodb-migration",
      name: "MongoDB Migration",
      icon: <Upload className="w-6 h-6" />,
      description: "Migrate your data to MongoDB Atlas with RAG capabilities",
      status: "Available",
      color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      action: () => setMigrationDialogOpen(true)
    },
    {
      id: "export",
      name: "Bulk Export",
      icon: <Download className="w-6 h-6" />,
      description: "Export multiple recordings and analysis results in various formats",
      status: "Available",
      color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      action: () => {} // Navigate to export tab
    },
    {
      id: "analytics",
      name: "Advanced Analytics",
      icon: <BarChart3 className="w-6 h-6" />,
      description: "Comprehensive analytics dashboard with trends and insights",
      status: "Beta",
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      action: () => {}
    }
  ];

  const stats = {
    totalProjects: projects.length,
    totalRecordings: recordings.length,
    totalTranscriptions: recordings.filter(r => r.raw_transcript).length,
    totalAnalyses: recordings.filter(r => r.summary !== null).length
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="search">AI Search</TabsTrigger>
          <TabsTrigger value="migration">Migration</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        {/* AI Semantic Search */}
        <TabsContent value="search" className="space-y-6">
          <SemanticSearchInterface
            onRecordingClick={(recording) => {
              console.log("Recording clicked:", recording);
              // Could navigate to recording details
            }}
            onKnowledgeClick={(knowledge) => {
              console.log("Knowledge clicked:", knowledge);
              // Could navigate to knowledge details
            }}
          />
        </TabsContent>

        {/* MongoDB Migration */}
        <TabsContent value="migration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-6 h-6" />
                MongoDB Atlas Migration
              </CardTitle>
              <CardDescription>
                Migrate your SQLite data to MongoDB Atlas with enhanced RAG capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold">Current Database</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    SQLite database with {stats.totalProjects} projects and {stats.totalRecordings} recordings
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span>Projects:</span>
                      <Badge variant="outline">{stats.totalProjects}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Recordings:</span>
                      <Badge variant="outline">{stats.totalRecordings}</Badge>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg border-green-200 bg-green-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-800">MongoDB Atlas</h4>
                  </div>
                  <p className="text-sm text-green-700 mb-3">
                    Cloud database with AI-powered semantic search and RAG capabilities
                  </p>
                  <div className="space-y-1 text-xs text-green-700">
                    <div className="flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" />
                      VoyageAI embeddings for semantic search
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" />
                      Vector similarity matching
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" />
                      Enhanced AI context retrieval
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Migration Process</h4>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Data Migration</p>
                      <p className="text-xs text-muted-foreground">Copy projects and recordings to MongoDB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-green-600">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Embedding Generation</p>
                      <p className="text-xs text-muted-foreground">Generate VoyageAI embeddings for semantic search</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-purple-600">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Verification</p>
                      <p className="text-xs text-muted-foreground">Validate data integrity and completeness</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setMigrationDialogOpen(true)}
                className="w-full gap-2"
                size="lg"
              >
                <Upload className="w-4 h-4" />
                Start Migration to MongoDB Atlas
              </Button>
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
                    onClick={tool.action}
                  >
                    {tool.status === 'Coming Soon' ? 'Coming Soon' : 'Launch Tool'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Migration Dialog */}
      <MigrationProgressDialog
        open={migrationDialogOpen}
        onOpenChange={setMigrationDialogOpen}
      />
    </div>
  );
}