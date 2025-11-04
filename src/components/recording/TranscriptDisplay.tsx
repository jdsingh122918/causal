import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranscription } from "@/contexts/TranscriptionContext";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function TranscriptDisplay() {
  const { state, clearTranscript, copyTranscript } = useTranscription();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new text arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.transcriptText]);

  const handleCopy = () => {
    copyTranscript();
    toast.success("Transcript copied to clipboard");
  };

  const handleClear = () => {
    clearTranscript();
    toast.success("Transcript cleared");
  };

  return (
    <Card className="flex flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Live Transcript</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!state.transcriptText}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={!state.transcriptText && !state.isRecording}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <ScrollArea className="h-96 rounded-md border bg-muted/50 p-4">
        <div ref={scrollRef} className="min-h-full">
          {state.transcriptText ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {state.transcriptText}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {state.isRecording
                ? "Listening... Start speaking to see the transcript."
                : "No transcript yet. Start recording to see the live transcript."}
            </p>
          )}
        </div>
      </ScrollArea>

      {state.enhancedBuffers.size > 0 && (
        <div className="mt-4 rounded-md border bg-accent/50 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            AI Enhanced Transcript ({state.enhancedBuffers.size} chunks
            processed)
          </p>
          <div className="space-y-2">
            {Array.from(state.enhancedBuffers.entries()).map(([id, text]) => (
              <div key={id} className="text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  #{id}:
                </span>{" "}
                {text}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
