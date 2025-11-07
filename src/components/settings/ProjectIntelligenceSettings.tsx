import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";

export function ProjectIntelligenceSettings() {
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => navigate('/intelligence/settings')}
    >
      <Brain className="h-4 w-4" />
      Intelligence Settings
    </Button>
  );
}