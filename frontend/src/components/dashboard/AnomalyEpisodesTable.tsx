import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Search, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DETECTOR_LABELS } from "@/constants/detectors";
import type { AnomalyEpisode } from "@/types";

interface AnomalyEpisodesTableProps {
  episodes: AnomalyEpisode[];
  highlightedEpisode: AnomalyEpisode | null;
  onSelectEpisode: (episode: AnomalyEpisode) => void;
  onClearHighlight: () => void;
}

function formatDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function getEpisodeSeries(episode: AnomalyEpisode): string[] {
  return Array.isArray(episode.series) ? episode.series : [];
}

function getEpisodeDirection(episode: AnomalyEpisode): "spike" | "drop" {
  if (episode.direction === "spike" || episode.direction === "drop") return episode.direction;
  if (episode.direction === "high") return "spike";
  if (episode.direction === "low") return "drop";
  return (episode.deviation_pct ?? 0) < 0 ? "drop" : "spike";
}

export function AnomalyEpisodesTable({
  episodes,
  highlightedEpisode,
  onSelectEpisode,
  onClearHighlight,
}: AnomalyEpisodesTableProps) {
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "spike" | "drop">("all");

  const filteredEpisodes = useMemo(() => {
    return episodes.filter((ep) => {
      const direction = getEpisodeDirection(ep);
      if (directionFilter !== "all" && direction !== directionFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const seriesMatch = getEpisodeSeries(ep).some((s) => s.toLowerCase().includes(q));
      const detectorMatch = ep.detectors.some((d) => d.toLowerCase().includes(q));
      const dateMatch =
        ep.start_date.includes(q) ||
        ep.end_date.includes(q) ||
        (ep.peak_date && ep.peak_date.includes(q));
      return seriesMatch || detectorMatch || dateMatch;
    });
  }, [episodes, search, directionFilter]);

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold tracking-tight">
                Consolidated Anomaly Episodes
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-[11px] px-2 py-0">
                {episodes.length} episodes
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Click a row to pin on telemetry chart
            </CardDescription>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search mine, algorithm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center rounded-[8px] border border-[rgba(128,128,128,0.22)] bg-[#141720] p-0.5">
              <button
                type="button"
                onClick={() => setDirectionFilter("all")}
                className={`px-2.5 py-1 text-xs rounded-[6px] transition-colors cursor-pointer font-medium ${
                  directionFilter === "all"
                    ? "bg-[#6366f1] text-white shadow-2xs"
                    : "text-[rgba(148,163,184,0.8)] hover:text-[#f8fafc]"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter("spike")}
                className={`px-2.5 py-1 text-xs rounded-[6px] transition-colors cursor-pointer font-medium ${
                  directionFilter === "spike"
                    ? "bg-[#6366f1] text-white shadow-2xs"
                    : "text-[rgba(148,163,184,0.8)] hover:text-[#f8fafc]"
                }`}
              >
                Spikes
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter("drop")}
                className={`px-2.5 py-1 text-xs rounded-[6px] transition-colors cursor-pointer font-medium ${
                  directionFilter === "drop"
                    ? "bg-[#6366f1] text-white shadow-2xs"
                    : "text-[rgba(148,163,184,0.8)] hover:text-[#f8fafc]"
                }`}
              >
                Drops
              </button>
            </div>

            {highlightedEpisode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearHighlight}
                className="h-8 text-xs px-2 text-rose-600 hover:text-rose-700 cursor-pointer gap-1"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear Pin</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-[380px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-xs">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider pl-4 sm:pl-5">
                  Event
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider">
                  Affected Series
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider">
                  Timeline (Start — End)
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider">
                  Peak Date
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider">
                  Deviation
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider pr-4 sm:pr-5">
                  Detection Consensus
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredEpisodes.length ? (
                filteredEpisodes.map((episode, index) => {
                  const direction = getEpisodeDirection(episode);
                  const seriesNames = getEpisodeSeries(episode);
                  const isHighlighted =
                    highlightedEpisode === episode ||
                    (highlightedEpisode != null &&
                      highlightedEpisode.start_date === episode.start_date &&
                      highlightedEpisode.end_date === episode.end_date &&
                      getEpisodeSeries(highlightedEpisode).join(",") === seriesNames.join(","));

                  return (
                    <TableRow
                      key={`${episode.start_date}-${seriesNames.join("-")}-${index}`}
                      onClick={() => onSelectEpisode(episode)}
                      className={`cursor-pointer transition-colors ${
                        isHighlighted
                          ? "bg-indigo-950/40 text-indigo-200 border-l-2 border-l-[#6366f1] font-semibold"
                          : "hover:bg-[#222532]/60"
                      }`}
                    >
                      <TableCell className="pl-4 sm:pl-5">
                        {direction === "spike" ? (
                          <Badge
                            variant="destructive"
                            className="gap-1 font-mono text-[10px] bg-rose-500/15 text-rose-400 border-rose-500/30"
                          >
                            <TrendingUp className="h-3 w-3" />
                            Spike
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="gap-1 font-mono text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/30"
                          >
                            <TrendingDown className="h-3 w-3" />
                            Drop
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="font-medium text-foreground">
                        {seriesNames.join(", ") || "Total aggregate"}
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDate(episode.start_date)}
                        {episode.end_date !== episode.start_date && (
                          <span> — {formatDate(episode.end_date)}</span>
                        )}
                      </TableCell>

                      <TableCell className="font-mono text-xs text-foreground">
                        {episode.peak_date
                          ? formatDate(episode.peak_date)
                          : formatDate(episode.start_date)}
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs">
                        {episode.deviation_pct != null ? (
                          <span
                            className={
                              episode.deviation_pct > 0
                                ? "text-rose-600 dark:text-rose-400 font-semibold"
                                : "text-blue-600 dark:text-blue-400 font-semibold"
                            }
                          >
                            {episode.deviation_pct > 0 ? "+" : ""}
                            {formatNumber(episode.deviation_pct, 1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="pr-4 sm:pr-5">
                        <div className="flex flex-wrap gap-1">
                          {episode.detectors.map((det) => (
                            <span
                              key={det}
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border/60"
                            >
                              {DETECTOR_LABELS[det as keyof typeof DETECTOR_LABELS] ?? det}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-xs text-muted-foreground font-mono"
                  >
                    {search || directionFilter !== "all"
                      ? "No anomaly episodes match the current search or filters."
                      : "Nominal operational state. No anomaly episodes detected under current sensitivity parameters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
