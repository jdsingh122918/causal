import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Download, FileText, FileJson, Brain } from 'lucide-react';
import { Recording } from '../../lib/types';
import { useRecordingIntelligence } from '../../hooks/use-recording-intelligence';

interface ExportTabProps {
  recording: Recording;
}

export function ExportTab({ recording }: ExportTabProps) {
  const recordingIntelligence = useRecordingIntelligence();

  const exportAsText = () => {
    const content = [
      `Recording: ${recording.name}`,
      `Date: ${new Date(recording.created_at).toLocaleDateString()}`,
      `Duration: ${Math.floor(recording.metadata.duration_seconds / 60)}:${String(Math.floor(recording.metadata.duration_seconds % 60)).padStart(2, '0')}`,
      '',
      'RAW TRANSCRIPT:',
      recording.raw_transcript || 'No raw transcript available',
      '',
      'ENHANCED TRANSCRIPT:',
      recording.enhanced_transcript || 'No enhanced transcript available',
    ];

    if (recording.summary) {
      content.push('', 'SUMMARY:', recording.summary);
    }

    if (recording.key_points && recording.key_points.length > 0) {
      content.push('', 'KEY POINTS:');
      recording.key_points.forEach(point => content.push(`• ${point}`));
    }

    if (recording.action_items && recording.action_items.length > 0) {
      content.push('', 'ACTION ITEMS:');
      recording.action_items.forEach(item => content.push(`• ${item}`));
    }

    const blob = new Blob([content.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.name}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportAsJson = () => {
    const data = {
      id: recording.id,
      name: recording.name,
      created_at: recording.created_at,
      status: recording.status,
      metadata: recording.metadata,
      raw_transcript: recording.raw_transcript,
      enhanced_transcript: recording.enhanced_transcript,
      summary: recording.summary,
      key_points: recording.key_points,
      action_items: recording.action_items,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.name}_data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportWithIntelligence = async () => {
    try {
      const analysisData = await recordingIntelligence.exportRecordingWithAnalysis(recording.id);

      if (analysisData) {
        const blob = new Blob([analysisData], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${recording.name}_with_analysis.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('No intelligence analysis found for this recording.');
      }
    } catch (error) {
      console.error('Failed to export with analysis:', error);
      alert('Failed to export recording with analysis.');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Export Recording</h3>
          </div>
          <p className="text-muted-foreground">
            Export this recording's transcripts and summary data in different formats.
          </p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold">Text Format</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Export as a readable text file containing all transcripts, summary, key points, and action items.
            </p>
            <Button onClick={exportAsText} className="w-full">
              <FileText className="h-4 w-4 mr-2" />
              Export as TXT
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold">JSON Format</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Export as structured JSON data including all metadata and content for programmatic use.
            </p>
            <Button onClick={exportAsJson} variant="outline" className="w-full">
              <FileJson className="h-4 w-4 mr-2" />
              Export as JSON
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <h4 className="font-semibold">With AI Analysis</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Export transcript with comprehensive AI analysis including sentiment, financial insights, competitive intelligence, and risk assessment.
            </p>
            <Button onClick={exportWithIntelligence} variant="outline" className="w-full bg-purple-50 border-purple-200 hover:bg-purple-100">
              <Brain className="h-4 w-4 mr-2" />
              Export with Analysis
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="space-y-2">
          <h4 className="font-semibold">Recording Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span> {recording.name}
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span> {recording.status}
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span> {new Date(recording.created_at).toLocaleDateString()}
            </div>
            <div>
              <span className="text-muted-foreground">Duration:</span> {Math.floor(recording.metadata.duration_seconds / 60)}:{String(Math.floor(recording.metadata.duration_seconds % 60)).padStart(2, '0')}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}