import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranscription } from "@/contexts/TranscriptionContext";
import { Copy, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function TranscriptDisplay() {
  const { state, clearTranscript, copyTranscript } = useTranscription();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRawText, setShowRawText] = useState(false);

  // Auto-scroll to bottom when new text arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.transcriptText, state.cleanedTranscript, state.enhancedBuffers]);

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
            onClick={() => setShowRawText(!showRawText)}
            className="gap-2"
            title={showRawText ? "Hide raw text" : "Show raw text"}
          >
            {showRawText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            Raw
          </Button>
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
          {state.transcriptText || state.cleanedTranscript || state.enhancedBuffers.size > 0 ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {/* Show enhanced chunks only by default, raw text on toggle */}
              {!showRawText ? (
                <div>
                  {/* Enhanced chunks only */}
                  {state.enhancedBuffers.size > 0 ? (
                    <div>
                      {Array.from(state.enhancedBuffers.entries())
                        .sort(([a], [b]) => a - b)
                        .map(([id, text], index) => (
                          <span key={id} className="enhanced-chunk">
                            {text}
                            {index < state.enhancedBuffers.size - 1 ? " " : ""}
                          </span>
                        ))}
                    </div>
                  ) : (
                    /* Show waiting message when recording but no enhanced chunks yet */
                    <p className="text-sm text-muted-foreground italic">
                      {state.isRecording
                        ? "Processing speech... Enhanced transcript will appear here."
                        : "No enhanced transcript available."}
                    </p>
                  )}
                </div>
              ) : (
                /* Show hybrid display when raw text toggle is enabled */
                <div>
                  {/* Enhanced chunks */}
                  {state.enhancedBuffers.size > 0 && (
                    <div className="mb-2">
                      {Array.from(state.enhancedBuffers.entries())
                        .sort(([a], [b]) => a - b)
                        .map(([id, text], index) => (
                          <span key={id} className="enhanced-chunk">
                            {text}
                            {index < state.enhancedBuffers.size - 1 ? " " : ""}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Raw text for ongoing/unprocessed turns during recording */}
                  {state.isRecording && state.transcriptText && (
                    <div className="text-muted-foreground/70 border-l-2 border-muted pl-3">
                      <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">Raw Text:</p>
                      {(() => {
                        const allTurns = Array.from(state.turns.entries()).sort(([a], [b]) => a - b);
                        const lastEnhancedTurn = state.enhancedBuffers.size > 0
                          ? Math.max(...Array.from(state.enhancedBuffers.keys()))
                          : -1;
                        const unprocessedTurns = allTurns.filter(([turnOrder]) => turnOrder > lastEnhancedTurn);
                        return unprocessedTurns.map(([, text]) => text).join("");
                      })()}
                    </div>
                  )}

                  {/* Full raw transcript when not recording and toggle is on */}
                  {!state.isRecording && state.transcriptText && (
                    <div className="text-muted-foreground/70 border-l-2 border-muted pl-3">
                      <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">Raw Text:</p>
                      {state.transcriptText}
                    </div>
                  )}
                </div>
              )}
            </div>
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
          <p className="text-xs font-medium text-muted-foreground">
            ✨ AI Enhanced - {state.enhancedBuffers.size} chunks processed
          </p>
        </div>
      )}
    </Card>
  );
}
