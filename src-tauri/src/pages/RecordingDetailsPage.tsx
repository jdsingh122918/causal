import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useRecordings } from "@/contexts/RecordingsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import {
  ArrowLeft,
  Play,
  Pause,
  Download,
  Share,
  Edit,
  Trash2,
  Clock,
  Calendar,
  User,
  FileText,
  Brain,
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle
} from "lucide-react";
import type { Recording } from "@/lib/types";

export function RecordingDetailsPage() {
  const { recordingId } = useParams();
  const navigate = useNavigate();
  const { recordings, updateRecordingName, deleteRecording } = useRecordings();
  const { projects } = useProjects();
  
  const [recording, setRecording] = useState<Recording | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (recordingId) {
      const foundRecording = recordings.find(r => r.id === recordingId);
      setRecording(foundRecording || null);
    }
  }, [recordingId, recordings]);

  if (!recording) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Recording Not Found</h3>
            <p className="text-muted-foreground">
              The recording you're looking for doesn't exist or may have been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const project = projects.find(p => p.id === recording.project_id);
  const duration = recording.duration_seconds || 0;
  const formattedDuration = Math.floor(duration / 60) + ':' + (duration % 60).toString().padStart(2, '0');

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    // Placeholder for actual audio playback
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
      deleteRecording(recording.id);
      navigate('/');
    }
  };

  const analysisData = recording.analysis ? JSON.parse(recording.analysis) : null;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{recording.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            {project && (
              <>
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {project.name}
                </span>
                <Separator orientation="vertical" className="h-4" />
              </>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(recording.created_at).toLocaleDateString()}
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formattedDuration}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePlayPause}>
            {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline">
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2">
        <Badge variant="default">
          {recording.status || 'Completed'}
        </Badge>
        {recording.transcript && (
          <Badge variant="secondary">
            Transcribed
          </Badge>
        )}
        {recording.analysis && (
          <Badge variant="secondary">
            Analyzed
          </Badge>
        )}
      </div>

      <Tabs defaultValue="transcript" className="space-y-6">
        <TabsList>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Transcript
              </CardTitle>
              <CardDescription>
                Full transcription of the recording
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recording.transcript ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed p-4 bg-muted rounded-lg">
                    {recording.transcript}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No transcript available for this recording.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          {analysisData ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Analysis sections would go here */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Analysis Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Analysis data available but display components are placeholder.</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <h4 className="text-lg font-semibold mb-2">No Analysis Available</h4>
                <p className="text-muted-foreground">
                  Intelligence analysis hasn't been performed on this recording yet.
                </p>
                <Button className="mt-4">
                  <Brain className="w-4 h-4 mr-2" />
                  Run Analysis
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recording Metadata</CardTitle>
              <CardDescription>
                Technical details and information about this recording
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium">Recording ID</span>
                    <p className="text-sm text-muted-foreground font-mono">{recording.id}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Created</span>
                    <p className="text-sm text-muted-foreground">
                      {new Date(recording.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Duration</span>
                    <p className="text-sm text-muted-foreground">{formattedDuration}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Project</span>
                    <p className="text-sm text-muted-foreground">{project?.name || 'No Project'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium">Status</span>
                    <p className="text-sm text-muted-foreground">{recording.status || 'Completed'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">File Path</span>
                    <p className="text-sm text-muted-foreground font-mono">
                      {recording.file_path || 'Not available'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Transcript Length</span>
                    <p className="text-sm text-muted-foreground">
                      {recording.transcript ? recording.transcript.length + ' characters' : 'No transcript'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Analysis Status</span>
                    <p className="text-sm text-muted-foreground">
                      {recording.analysis ? 'Completed' : 'Not analyzed'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
