import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { SLIDER_CONFIGS, TREND_DEGREE_OPTIONS } from "@/constants/analytics";
import type { AnalysisParams, Basis } from "@/types";

interface ControlPanelProps {
  params: AnalysisParams;
  defaultParams: AnalysisParams;
  availableSeries: string[];
  seriesChoice: string;
  onParamChange: <K extends keyof AnalysisParams>(key: K, value: AnalysisParams[K]) => void;
  onSeriesChange: (series: string) => void;
  onReset: () => void;
}

export function ControlPanel({
  params,
  defaultParams,
  availableSeries,
  seriesChoice,
  onParamChange,
  onSeriesChange,
  onReset,
}: ControlPanelProps) {
  const isDirty = JSON.stringify(params) !== JSON.stringify(defaultParams);

  return (
    <Card className="border-border shadow-xs">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#818cf8]" />
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            Analysis Controls
          </CardTitle>
        </div>
        {isDirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-1 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
            <span>Detection Basis</span>
            <span className="font-mono text-[10px] text-indigo-400 font-semibold uppercase">
              {params.basis === "raw" ? "Raw Data" : "De-trended"}
            </span>
          </label>
          <Tabs
            value={params.basis}
            onValueChange={(val) => onParamChange("basis", val as Basis)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 h-8 p-0.5 bg-muted/60">
              <TabsTrigger value="raw" className="text-xs py-1">
                Raw Output
              </TabsTrigger>
              <TabsTrigger value="adjusted" className="text-xs py-1">
                De-trended
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Separator />

        <div className="space-y-3.5">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase font-mono">
            Detection Sensitivity
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">IQR Multiplier (k)</span>
              <span className="font-mono font-medium text-foreground bg-muted/50 px-1.5 py-0.5 rounded text-[11px]">
                {params.iqr_k.toFixed(1)}×
              </span>
            </div>
            <Slider
              value={[params.iqr_k]}
              min={SLIDER_CONFIGS.iqr_k.min}
              max={SLIDER_CONFIGS.iqr_k.max}
              step={SLIDER_CONFIGS.iqr_k.step}
              onValueChange={([val]) => onParamChange("iqr_k", val)}
              aria-label="IQR Multiplier"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Z-Score Threshold (σ)</span>
              <span className="font-mono font-medium text-foreground bg-muted/50 px-1.5 py-0.5 rounded text-[11px]">
                {params.z_threshold.toFixed(1)}σ
              </span>
            </div>
            <Slider
              value={[params.z_threshold]}
              min={SLIDER_CONFIGS.z_threshold.min}
              max={SLIDER_CONFIGS.z_threshold.max}
              step={SLIDER_CONFIGS.z_threshold.step}
              onValueChange={([val]) => onParamChange("z_threshold", val)}
              aria-label="Z-Score Threshold"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">MA Window</span>
              <span className="font-mono font-medium text-foreground bg-muted/50 px-1.5 py-0.5 rounded text-[11px]">
                {params.ma_window} days
              </span>
            </div>
            <Slider
              value={[params.ma_window]}
              min={SLIDER_CONFIGS.ma_window.min}
              max={SLIDER_CONFIGS.ma_window.max}
              step={SLIDER_CONFIGS.ma_window.step}
              onValueChange={([val]) => onParamChange("ma_window", val)}
              aria-label="Moving Average Window"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">MA Deviation Threshold</span>
              <span className="font-mono font-medium text-foreground bg-muted/50 px-1.5 py-0.5 rounded text-[11px]">
                {params.ma_threshold_pct}%
              </span>
            </div>
            <Slider
              value={[params.ma_threshold_pct]}
              min={SLIDER_CONFIGS.ma_threshold_pct.min}
              max={SLIDER_CONFIGS.ma_threshold_pct.max}
              step={SLIDER_CONFIGS.ma_threshold_pct.step}
              onValueChange={([val]) => onParamChange("ma_threshold_pct", val)}
              aria-label="Moving Average Deviation Threshold"
            />
          </div>

          <div className="space-y-1.5 pt-0.5">
            <label className="text-xs text-muted-foreground flex items-center justify-between">
              <span>MA Alignment</span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                {params.ma_centered ? "Centered" : "Trailing"}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-1 rounded-sm border border-border bg-[#141720] p-1">
              <Button
                type="button"
                variant={params.ma_centered ? "default" : "ghost"}
                size="sm"
                onClick={() => onParamChange("ma_centered", true)}
                className={`h-7 text-xs ${
                  params.ma_centered
                    ? "bg-[#6366f1] text-white shadow-2xs font-medium"
                    : "text-[rgba(148,163,184,0.85)] hover:text-[#f8fafc]"
                }`}
              >
                Centered
              </Button>
              <Button
                type="button"
                variant={!params.ma_centered ? "default" : "ghost"}
                size="sm"
                onClick={() => onParamChange("ma_centered", false)}
                className={`h-7 text-xs ${
                  !params.ma_centered
                    ? "bg-[#6366f1] text-white shadow-2xs font-medium"
                    : "text-[rgba(148,163,184,0.85)] hover:text-[#f8fafc]"
                }`}
              >
                Trailing
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Grubbs Significance (α)</span>
              <span className="font-mono font-medium text-foreground bg-muted/50 px-1.5 py-0.5 rounded text-[11px]">
                {params.grubbs_alpha.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[params.grubbs_alpha]}
              min={SLIDER_CONFIGS.grubbs_alpha.min}
              max={SLIDER_CONFIGS.grubbs_alpha.max}
              step={SLIDER_CONFIGS.grubbs_alpha.step}
              onValueChange={([val]) => onParamChange("grubbs_alpha", val)}
              aria-label="Grubbs Alpha"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase font-mono">
            Model Configuration
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Polynomial Trendline Degree</label>
            <Select
              value={String(params.trend_degree)}
              onValueChange={(val) => onParamChange("trend_degree", Number(val))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select degree" />
              </SelectTrigger>
              <SelectContent>
                {TREND_DEGREE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Focus Series</label>
            <Select value={seriesChoice} onValueChange={onSeriesChange}>
              <SelectTrigger className="h-8 text-xs font-medium">
                <SelectValue placeholder="Select series" />
              </SelectTrigger>
              <SelectContent>
                {availableSeries.map((series) => (
                  <SelectItem key={series} value={series}>
                    {series}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
