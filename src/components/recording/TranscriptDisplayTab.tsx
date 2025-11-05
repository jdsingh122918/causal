import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';

interface TranscriptDisplayTabProps {
  content: string | null;
  type: 'raw' | 'enhanced';
}

export function TranscriptDisplayTab({ content, type }: TranscriptDisplayTabProps) {
  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">
            No {type} transcript available
          </p>
          <p className="text-sm text-muted-foreground">
            {type === 'enhanced'
              ? 'Enhanced transcripts are generated when AI refinement is enabled in settings.'
              : 'Raw transcripts are created during the recording process.'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold capitalize">
            {type} Transcript
          </h3>
          <span className="text-sm text-muted-foreground">
            {content.split(' ').length} words
          </span>
        </div>

        <ScrollArea className="h-[500px] w-full">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-foreground leading-relaxed">
              {content}
            </p>
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}