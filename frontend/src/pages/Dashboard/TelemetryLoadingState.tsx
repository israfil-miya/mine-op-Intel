import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function TelemetryLoadingState() {
  return (
    <Card className="border-border p-12 text-center shadow-xs">
      <CardContent className="space-y-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-[#818cf8] animate-pulse">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Calculating Anomaly Detection Models...
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Computing statistical distributions, polynomial trendline fits, and multi-detector
          consensus across all facility data points.
        </p>
      </CardContent>
    </Card>
  );
}
