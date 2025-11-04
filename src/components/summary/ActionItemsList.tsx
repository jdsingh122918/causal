import { Card } from "@/components/ui/card";
import { CircleDot } from "lucide-react";

interface ActionItemsListProps {
  actionItems: string[];
}

export function ActionItemsList({ actionItems }: ActionItemsListProps) {
  if (actionItems.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No action items available. Generate a summary first.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h4 className="mb-4 text-base font-semibold">Action Items</h4>
      <div className="space-y-3">
        {actionItems.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
              {item}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
