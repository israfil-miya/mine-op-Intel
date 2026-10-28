import { Activity, BarChart3, CalendarDays, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Statistics } from "@/types";

interface MetricsGridProps {
  stats?: Statistics;
  seriesName: string;
  totalFlags: number;
  episodesCount: number;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function MetricsGrid({ stats, seriesName, totalFlags, episodesCount }: MetricsGridProps) {
  const iqr =
    stats?.q1 != null && stats?.q3 != null
      ? (stats.q3 - stats.q1).toLocaleString(undefined, { maximumFractionDigits: 1 })
      : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3.5 sm:gap-4">
      <Card className="relative overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-[0.82rem] font-bold text-[#f8fafc]/85 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <Activity className="h-4 w-4 text-[#818cf8] shrink-0" />
              <span>Mean Output</span>
            </span>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] border border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.08)] text-[rgba(148,163,184,0.95)] text-xs font-medium font-mono shrink-0">
              {seriesName}
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-[1.85rem] font-extrabold tracking-tight text-[#f8fafc] font-mono leading-none">
              {formatNumber(stats?.mean)}
            </span>
            <span className="text-xs text-muted-foreground">units/day</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono uppercase pt-0.5">
            Sum: {formatNumber(stats?.sum, 0)} | {stats?.count ?? 0} days
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-[0.82rem] font-bold text-[#f8fafc]/85 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <BarChart3 className="h-4 w-4 text-[#818cf8] shrink-0" />
              <span>Variability (Std Dev)</span>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">ddof=0</span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-[1.85rem] font-extrabold tracking-tight text-[#f8fafc] font-mono leading-none">
              {formatNumber(stats?.std)}
            </span>
            <span className="text-xs text-muted-foreground">σ dispersion</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono uppercase pt-0.5">
            Range: [{formatNumber(stats?.min, 0)} - {formatNumber(stats?.max, 0)}]
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-[0.82rem] font-bold text-[#f8fafc]/85 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <CalendarDays className="h-4 w-4 text-[#818cf8] shrink-0" />
              <span>Median Output</span>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">Q2 (50%)</span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-[1.85rem] font-extrabold tracking-tight text-[#f8fafc] font-mono leading-none">
              {formatNumber(stats?.median)}
            </span>
            <span className="text-xs text-muted-foreground">units/day</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono uppercase pt-0.5">
            {iqr ? `IQR Spread: ${iqr} units` : "Interquartile range"}
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-[0.82rem] font-bold text-[#f8fafc]/85 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>Flagged Anomalies</span>
            </span>
            {totalFlags > 0 ? (
              <Badge variant="destructive" className="text-[10px] font-mono px-1.5 py-0 shrink-0">
                {totalFlags} points
              </Badge>
            ) : (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium font-mono shrink-0">
                Nominal
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-[1.85rem] font-extrabold tracking-tight text-[#f8fafc] font-mono leading-none">
              {totalFlags.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">data alerts</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono uppercase pt-0.5">
            {episodesCount} consolidated episodes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
