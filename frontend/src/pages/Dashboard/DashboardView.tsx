import { ControlPanel } from "@/components/dashboard/ControlPanel";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { SeriesStatsTable } from "@/components/dashboard/SeriesStatsTable";
import { AnomalyEpisodesTable } from "@/components/dashboard/AnomalyEpisodesTable";
import type {
  AnalysisParams,
  AnalysisResponse,
  AnomalyEpisode,
  ChartType,
  DetectorName,
  SeriesAnalysis,
} from "@/types";

interface DashboardViewProps {
  params: AnalysisParams;
  defaultParams: AnalysisParams;
  availableSeries: string[];
  seriesChoice: string;
  result: AnalysisResponse;
  selectedSeriesData?: SeriesAnalysis;
  totalSeriesData?: SeriesAnalysis;
  totalFlags: number;
  episodes: AnomalyEpisode[];
  chartType: ChartType;
  visibleDetectors: DetectorName[];
  highlightedEpisode: AnomalyEpisode | null;
  isUpdating: boolean;
  onParamChange: <K extends keyof AnalysisParams>(key: K, value: AnalysisParams[K]) => void;
  onResetParams: () => void;
  onSeriesChange: (series: string) => void;
  onChartTypeChange: (type: ChartType) => void;
  onToggleDetector: (detector: DetectorName) => void;
  onSelectEpisode: (episode: AnomalyEpisode) => void;
  onClearEpisode: () => void;
}

export function DashboardView({
  params,
  defaultParams,
  availableSeries,
  seriesChoice,
  result,
  selectedSeriesData,
  totalSeriesData,
  totalFlags,
  episodes,
  chartType,
  visibleDetectors,
  highlightedEpisode,
  isUpdating,
  onParamChange,
  onResetParams,
  onSeriesChange,
  onChartTypeChange,
  onToggleDetector,
  onSelectEpisode,
  onClearEpisode,
}: DashboardViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <aside className="lg:col-span-3 space-y-4">
        <ControlPanel
          params={params}
          defaultParams={defaultParams}
          availableSeries={availableSeries}
          seriesChoice={seriesChoice}
          onParamChange={onParamChange}
          onSeriesChange={onSeriesChange}
          onReset={onResetParams}
        />
      </aside>

      <main className="lg:col-span-9 space-y-6">
        <MetricsGrid
          stats={
            seriesChoice === "Total" ? totalSeriesData?.statistics : selectedSeriesData?.statistics
          }
          seriesName={seriesChoice}
          totalFlags={totalFlags}
          episodesCount={episodes.length}
        />

        <AnalyticsChart
          result={result}
          chartType={chartType}
          seriesChoice={seriesChoice}
          availableSeries={availableSeries}
          visibleDetectors={visibleDetectors}
          highlightedEpisode={highlightedEpisode}
          onChartTypeChange={onChartTypeChange}
          onToggleDetector={onToggleDetector}
        />

        <SeriesStatsTable
          seriesData={result.series}
          availableSeries={availableSeries}
          selectedSeries={seriesChoice}
          isUpdating={isUpdating}
          onSelectSeries={onSeriesChange}
        />

        <AnomalyEpisodesTable
          episodes={episodes}
          highlightedEpisode={highlightedEpisode}
          onSelectEpisode={onSelectEpisode}
          onClearHighlight={onClearEpisode}
        />
      </main>
    </div>
  );
}
