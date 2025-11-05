import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Loader2, Check, Circle, AlertCircle } from 'lucide-react';
import { Recording } from '../../lib/types';
import { useRecordings } from '../../contexts/RecordingsContext';

interface SummaryDisplayProps {
  recording: Recording;
}

export function SummaryDisplay({ recording }: SummaryDisplayProps) {
  const { generateSummary } = useRecordings();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      await generateSummary(recording.id);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // If no summary exists, show generation UI
  if (!recording.summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4 max-w-md">
          {isGenerating ? (
            <div className="space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Generating Summary</h3>
                <p className="text-muted-foreground">
                  AI is analyzing the transcript to create a summary, key points, and action items.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Summary Available</h3>
                <p className="text-muted-foreground">
                  Generate an AI-powered summary with key points and action items from this recording.
                </p>
              </div>
              <Button onClick={handleGenerateSummary} disabled={isGenerating}>
                Generate Summary
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Summary</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateSummary}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Regenerating...
              </>
            ) : (
              'Regenerate'
            )}
          </Button>
        </div>
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-foreground leading-relaxed">
            {recording.summary}
          </p>
        </div>
      </Card>

      {/* Key Points */}
      {recording.key_points && recording.key_points.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Key Points
          </h3>
          <ul className="space-y-3">
            {recording.key_points.map((point, index) => (
              <li key={index} className="flex items-start gap-3">
                <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                <span className="text-sm leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Action Items */}
      {recording.action_items && recording.action_items.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Circle className="h-5 w-5 text-blue-600" />
            Action Items
          </h3>
          <ul className="space-y-3">
            {recording.action_items.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <Circle className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                <span className="text-sm leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Empty state for key points and action items */}
      {(!recording.key_points || recording.key_points.length === 0) &&
       (!recording.action_items || recording.action_items.length === 0) && (
        <Card className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No additional key points or action items identified in this recording.</p>
          </div>
        </Card>
      )}
    </div>
  );
}