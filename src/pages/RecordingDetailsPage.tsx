import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { useRecordings } from '../contexts/RecordingsContext';
import { useProjects } from '../contexts/ProjectsContext';
import { Recording } from '../lib/types';
import { SummaryDisplay } from '../components/summary/SummaryDisplay';
import { TranscriptDisplayTab } from '../components/recording/TranscriptDisplayTab';
import { ExportTab } from '../components/recording/ExportTab';

export function RecordingDetailsPage() {
  const { recordingId } = useParams<{ recordingId: string }>();
  const navigate = useNavigate();
  const { recordings } = useRecordings();
  const { currentProject } = useProjects();
  const [recording, setRecording] = useState<Recording | null>(null);

  useEffect(() => {
    if (recordingId && recordings.length > 0) {
      const found = recordings.find(r => r.id === recordingId);
      setRecording(found || null);
    }
  }, [recordingId, recordings]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'default';
      case 'Recording':
        return 'destructive';
      case 'Processing':
        return 'secondary';
      case 'Failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (!recording) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Recording not found</h2>
          <p className="text-muted-foreground">
            The recording you're looking for could not be found.
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Recordings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb and Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="p-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {currentProject?.name || 'Recordings'}
        </Button>
      </div>

      {/* Recording Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{recording.name}</h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(recording.created_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(recording.metadata.duration_seconds)}</span>
              </div>
              <Badge variant={getStatusBadgeVariant(recording.status)}>
                {recording.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="raw">Raw Transcript</TabsTrigger>
          <TabsTrigger value="enhanced">Enhanced</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <SummaryDisplay recording={recording} />
        </TabsContent>

        <TabsContent value="raw" className="mt-6">
          <TranscriptDisplayTab content={recording.raw_transcript} type="raw" />
        </TabsContent>

        <TabsContent value="enhanced" className="mt-6">
          <TranscriptDisplayTab content={recording.enhanced_transcript} type="enhanced" />
        </TabsContent>

        <TabsContent value="export" className="mt-6">
          <ExportTab recording={recording} />
        </TabsContent>
      </Tabs>
    </div>
  );
}