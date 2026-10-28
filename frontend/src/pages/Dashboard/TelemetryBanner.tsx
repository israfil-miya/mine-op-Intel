import { Calendar, Database, RefreshCw } from "lucide-react";
import type { DashboardMeta } from "@/types";

interface TelemetryBannerProps {
  metaData?: DashboardMeta;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function TelemetryBanner({ metaData }: TelemetryBannerProps) {
  return (
    <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/60 pb-5">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Mining Operations Telemetry
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time anomaly monitoring, multi-algorithm consensus analysis, and polynomial trend
          estimation.
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs font-mono">
        {metaData ? (
          <>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-[#1a1c24] shadow-2xs">
              <Database className="h-3.5 w-3.5 text-[#818cf8]" />
              <span className="text-muted-foreground">Observations:</span>
              <strong className="text-foreground">{metaData.row_count} days</strong>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-[#1a1c24] shadow-2xs">
              <Calendar className="h-3.5 w-3.5 text-[#818cf8]" />
              <span className="text-muted-foreground">Range:</span>
              <strong className="text-foreground">
                {formatDate(metaData.date_range.start)} — {formatDate(metaData.date_range.end)}
              </strong>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#818cf8]" />
            <span>Loading facility telemetry metadata...</span>
          </div>
        )}
      </div>
    </section>
  );
}
