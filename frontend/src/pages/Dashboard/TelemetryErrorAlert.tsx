import { AlertCircle } from "lucide-react";

interface TelemetryErrorAlertProps {
  error: unknown;
}

export function TelemetryErrorAlert({ error }: TelemetryErrorAlertProps) {
  if (!error) return null;

  const message =
    error instanceof Error ? error.message : "An unexpected telemetry error occurred.";

  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/30 p-4 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-3 shadow-xs">
      <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <strong className="font-semibold">Telemetry Service Interruption</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
