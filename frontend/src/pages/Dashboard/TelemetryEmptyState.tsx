import { Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function TelemetryEmptyState() {
  return (
    <Card className="border-border/80 p-12 text-center shadow-xs">
      <CardContent className="space-y-3">
        <Database className="h-10 w-10 text-muted-foreground mx-auto" />
        <h3 className="text-base font-semibold text-foreground">Telemetry Stream Unavailable</h3>
        <p className="text-xs text-muted-foreground">
          Ensure the backend service is running and accessible at /api.
        </p>
      </CardContent>
    </Card>
  );
}
