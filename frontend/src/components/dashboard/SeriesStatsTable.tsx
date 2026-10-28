import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DETECTOR_NAMES as detectorNames,
  DETECTOR_LABELS as detectorLabels,
  DETECTOR_COLORS as detectorColors,
} from "@/constants/detectors";
import type { SeriesAnalysis } from "@/types";

interface SeriesStatsTableProps {
  seriesData: Record<string, SeriesAnalysis>;
  availableSeries: string[];
  selectedSeries: string;
  isUpdating: boolean;
  onSelectSeries: (series: string) => void;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function SeriesStatsTable({
  seriesData,
  availableSeries,
  selectedSeries,
  isUpdating,
  onSelectSeries,
}: SeriesStatsTableProps) {
  const mineSeries = availableSeries.filter((name) => name !== "Total");
  const totalItem = seriesData["Total"];

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="p-4 sm:p-5 pb-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight">
            Series Statistical Measures
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Click any row to focus the chart telemetry on that mine | Std dev uses ddof=0
          </CardDescription>
        </div>
        {isUpdating && (
          <Badge
            variant="outline"
            className="text-[10px] font-mono animate-pulse border-indigo-500/30 text-indigo-400"
          >
            Updating
          </Badge>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-[11px] uppercase tracking-wider pl-4 sm:pl-5">
                Mine / Facility
              </TableHead>
              <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider">
                Mean
              </TableHead>
              <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider">
                Std Dev (σ)
              </TableHead>
              <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider">
                Median
              </TableHead>
              <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider">
                IQR
              </TableHead>
              {detectorNames.map((detector) => (
                <TableHead
                  key={detector}
                  className="text-right font-mono text-[11px] uppercase tracking-wider pr-4 last:pr-5"
                >
                  {detectorLabels[detector]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {mineSeries.map((name) => {
              const item = seriesData[name];
              if (!item) return null;
              const stats = item.statistics;
              const iqr = stats.q1 == null || stats.q3 == null ? null : stats.q3 - stats.q1;
              const isSelected = selectedSeries === name;

              return (
                <TableRow
                  key={name}
                  onClick={() => onSelectSeries(name)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-indigo-950/40 text-indigo-200 border-l-2 border-l-[#6366f1] font-semibold"
                      : "hover:bg-[#222532]/60"
                  }`}
                >
                  <TableCell className="font-medium text-foreground pl-4 sm:pl-5 flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isSelected ? "bg-[#6366f1] ring-2 ring-indigo-500/30" : "bg-slate-700"
                      }`}
                    />
                    <span>{name}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatNumber(stats.mean)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatNumber(stats.std)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatNumber(stats.median)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatNumber(iqr)}
                  </TableCell>
                  {detectorNames.map((detector) => {
                    const count =
                      item.anomaly_counts?.[detector] ?? item.anomalies?.[detector]?.length ?? 0;
                    return (
                      <TableCell key={detector} className="text-right font-mono pr-4 last:pr-5">
                        {count > 0 ? (
                          <span
                            className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-2xs"
                            style={{ backgroundColor: detectorColors[detector] }}
                          >
                            {count}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-[11px]">0</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}

            {totalItem && (
              <TableRow
                onClick={() => onSelectSeries("Total")}
                className={`border-t-2 border-[rgba(128,128,128,0.25)] bg-[#1e202a] font-semibold cursor-pointer ${
                  selectedSeries === "Total"
                    ? "bg-indigo-950/50 text-indigo-200 border-l-2 border-l-[#6366f1]"
                    : "hover:bg-[#222532]/80"
                }`}
              >
                <TableCell className="pl-4 sm:pl-5 flex items-center gap-2 text-foreground font-semibold">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      selectedSeries === "Total"
                        ? "bg-[#6366f1] ring-2 ring-indigo-500/30"
                        : "bg-slate-500"
                    }`}
                  />
                  <span>Total Output (Aggregated)</span>
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-foreground">
                  {formatNumber(totalItem.statistics.mean)}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-foreground">
                  {formatNumber(totalItem.statistics.std)}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-foreground">
                  {formatNumber(totalItem.statistics.median)}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-foreground">
                  {totalItem.statistics.q1 != null && totalItem.statistics.q3 != null
                    ? formatNumber(totalItem.statistics.q3 - totalItem.statistics.q1)
                    : "—"}
                </TableCell>
                {detectorNames.map((detector) => {
                  const count =
                    totalItem.anomaly_counts?.[detector] ??
                    totalItem.anomalies?.[detector]?.length ??
                    0;
                  return (
                    <TableCell key={detector} className="text-right font-mono pr-4 last:pr-5">
                      {count > 0 ? (
                        <span
                          className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                          style={{ backgroundColor: detectorColors[detector] }}
                        >
                          {count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-[11px]">0</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
