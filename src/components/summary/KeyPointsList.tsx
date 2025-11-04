import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

interface KeyPointsListProps {
  keyPoints: string[];
}

export function KeyPointsList({ keyPoints }: KeyPointsListProps) {
  if (keyPoints.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No key points available. Generate a summary first.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h4 className="mb-4 text-base font-semibold">Key Points</h4>
      <div className="space-y-3">
        {keyPoints.map((point, index) => (
          <div key={index} className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
              {point}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
