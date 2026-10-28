import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { LineChart as LineIcon, BarChart2, Layers } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalysisResponse, AnomalyEpisode, ChartType, DetectorName } from "@/types";

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

import {
  DETECTOR_NAMES,
  DETECTOR_LABELS,
  DETECTOR_COLORS,
  CHART_PALETTE,
} from "@/constants/detectors";

function getSeriesColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

interface AnalyticsChartProps {
  result?: AnalysisResponse;
  chartType: ChartType;
  seriesChoice: string;
  availableSeries: string[];
  visibleDetectors: DetectorName[];
  highlightedEpisode: AnomalyEpisode | null;
  onChartTypeChange: (type: ChartType) => void;
  onToggleDetector: (detector: DetectorName) => void;
}

export function AnalyticsChart({
  result,
  chartType,
  seriesChoice,
  availableSeries,
  visibleDetectors,
  highlightedEpisode,
  onChartTypeChange,
  onToggleDetector,
}: AnalyticsChartProps) {
  const selectedData = result?.series[seriesChoice];

  const chartOption = useMemo<EChartsOption>(() => {
    const points = result?.points ?? [];
    const plottedSeries =
      chartType === "stacked"
        ? [
            ...availableSeries.filter((name) => name !== "Total"),
            ...(availableSeries.includes("Total") ? ["Total"] : []),
          ]
        : [seriesChoice];

    const chartSeries: NonNullable<EChartsOption["series"]> = [];
    const selectedPoints = points.filter((point) => point.series === seriesChoice);
    const selectedByDate = new Map(selectedPoints.map((point) => [point.date, point]));

    plottedSeries.forEach((name, index) => {
      const rows = points.filter((point) => point.series === name);
      const stackMine = chartType === "stacked" && name !== "Total";

      chartSeries.push({
        name,
        type: chartType === "bar" || chartType === "stacked" ? "bar" : "line",
        data: rows.map((point) => [point.date, point.value]),
        ...(chartType === "line" && name === seriesChoice
          ? {
              smooth: 0.2,
              showSymbol: false,
              lineStyle: { width: 2.5, color: getSeriesColor(index) },
              itemStyle: { color: getSeriesColor(index) },
            }
          : {
              itemStyle: { color: getSeriesColor(index) },
              barMaxWidth: 20,
            }),
        ...(stackMine ? { stack: "daily-output", areaStyle: { opacity: 0.65 } } : {}),
        ...(name === "Total" && chartType === "stacked"
          ? {
              type: "line" as const,
              showSymbol: false,
              lineStyle: { width: 2, type: "dashed" as const, color: "#334155" },
            }
          : {}),
        emphasis: { focus: "series" },
      });
    });

    if (chartType === "stacked" && !plottedSeries.length) {
      chartSeries.push({
        name: seriesChoice,
        type: "line",
        data: selectedPoints.map((point) => [point.date, point.value]),
        showSymbol: false,
        lineStyle: { color: "#0f172a" },
      });
    }

    if (selectedData) {
      chartSeries.push({
        name: `Trend - degree ${selectedData.trend.degree}`,
        type: "line",
        data: result?.dates.map((date, index) => [date, selectedData.trend.values[index]]) ?? [],
        showSymbol: false,
        symbol: "none",
        lineStyle: { color: "#818cf8", width: 1.8, type: "dashed" },
        z: 4,
      });

      for (const detector of visibleDetectors) {
        const anomalies = selectedData.anomalies?.[detector] ?? [];
        const dots = anomalies.flatMap((record) => {
          const point = selectedByDate.get(record.date);
          return point?.value == null ? [] : [[record.date, point.value]];
        });

        if (dots.length) {
          chartSeries.push({
            name: DETECTOR_LABELS[detector],
            type: "scatter",
            data: dots,
            symbolSize: 9,
            itemStyle: {
              color: DETECTOR_COLORS[detector],
              borderColor: "#ffffff",
              borderWidth: 1.5,
              shadowBlur: 4,
              shadowColor: "rgba(0,0,0,0.25)",
            },
            z: 8,
          });
        }
      }
    }

    const selectedStart = highlightedEpisode?.start_date;
    const markedPoint = selectedStart ? selectedByDate.get(selectedStart) : undefined;
    if (markedPoint?.value != null && chartSeries[0]) {
      chartSeries.push({
        name: "Selected Episode",
        type: "scatter",
        data: [[selectedStart, markedPoint.value]],
        symbol: "pin",
        symbolSize: 36,
        itemStyle: { color: "#f43f5e" },
        z: 10,
      });
    }

    const boundaryGap: [number | string, number | string] =
      chartType === "line" ? [0, 0] : ["3%", "3%"];

    return {
      animationDuration: 300,
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(26, 28, 36, 0.96)",
        borderColor: "rgba(128, 128, 128, 0.3)",
        borderWidth: 1,
        textStyle: { color: "#f8fafc", fontSize: 11, fontFamily: "monospace" },
        padding: [8, 12],
        axisPointer: {
          type: chartType === "bar" || chartType === "stacked" ? "shadow" : "cross",
          crossStyle: { color: "#94a3b8" },
        },
      },
      legend: {
        top: 6,
        right: 12,
        type: "scroll",
        textStyle: { color: "#94a3b8", fontSize: 10, fontFamily: "sans-serif" },
      },
      grid: { left: 48, right: 20, top: 44, bottom: 32 },
      xAxis: {
        type: "time",
        boundaryGap,
        axisLine: { lineStyle: { color: "rgba(128, 128, 128, 0.25)" } },
        axisTick: { show: false },
        axisLabel: { color: "#94a3b8", fontSize: 10, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#94a3b8", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(128, 128, 128, 0.15)", type: "dashed" } },
      },
      series: chartSeries,
    };
  }, [
    result,
    chartType,
    availableSeries,
    seriesChoice,
    selectedData,
    visibleDetectors,
    highlightedEpisode,
  ]);

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="p-4 sm:p-5 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
            <span>Production Output & Anomaly Telemetry</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            {chartType === "stacked"
              ? "All mine contributions stacked with Total aggregate reference"
              : `${seriesChoice} series | ${result?.basis ?? "raw"} telemetry readings`}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={chartType}
            onValueChange={(val) => onChartTypeChange(val as ChartType)}
            className="w-auto"
          >
            <TabsList className="h-8 p-0.5 bg-muted/70">
              <TabsTrigger value="line" className="text-xs px-2.5 py-1 gap-1 cursor-pointer">
                <LineIcon className="h-3 w-3" />
                <span>Line</span>
              </TabsTrigger>
              <TabsTrigger value="bar" className="text-xs px-2.5 py-1 gap-1 cursor-pointer">
                <BarChart2 className="h-3 w-3" />
                <span>Bar</span>
              </TabsTrigger>
              <TabsTrigger value="stacked" className="text-xs px-2.5 py-1 gap-1 cursor-pointer">
                <Layers className="h-3 w-3" />
                <span>Stacked</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
        <div className="h-[340px] sm:h-[380px] w-full rounded-lg border border-border/50 bg-background/50 p-1">
          <ReactEChartsCore
            echarts={echarts}
            option={chartOption}
            notMerge
            lazyUpdate
            style={{ height: "100%", width: "100%" }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground mr-1">
              Filter Detectors:
            </span>
            {DETECTOR_NAMES.map((detector) => {
              const active = visibleDetectors.includes(detector);
              return (
                <button
                  key={detector}
                  type="button"
                  onClick={() => onToggleDetector(detector)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] text-[11px] font-semibold tracking-wide transition-all cursor-pointer border ${
                    active
                      ? "bg-[#6366f1]/20 text-[#f8fafc] border-[#6366f1] shadow-xs"
                      : "bg-[#1a1c24] text-[rgba(148,163,184,0.7)] border-[rgba(128,128,128,0.25)] hover:text-[#f8fafc] hover:border-[rgba(128,128,128,0.4)]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full transition-opacity ${
                      active ? "opacity-100 ring-2 ring-white/20" : "opacity-30"
                    }`}
                    style={{ backgroundColor: DETECTOR_COLORS[detector] }}
                  />
                  <span>{DETECTOR_LABELS[detector]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono text-[10px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-slate-500" />
              Polynomial Trend
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
