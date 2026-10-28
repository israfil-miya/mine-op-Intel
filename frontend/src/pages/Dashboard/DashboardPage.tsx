import { Header } from "@/components/layout/Header";
import { useMiningTelemetry } from "@/hooks/useMiningTelemetry";
import { TelemetryBanner } from "./TelemetryBanner";
import { TelemetryErrorAlert } from "./TelemetryErrorAlert";
import { TelemetryLoadingState } from "./TelemetryLoadingState";
import { TelemetryEmptyState } from "./TelemetryEmptyState";
import { DashboardView } from "./DashboardView";

export function DashboardPage() {
  const {
    params,
    defaultParams,
    seriesChoice,
    chartType,
    visibleDetectors,
    highlightedEpisode,
    availableSeries,
    result,
    selectedSeriesData,
    totalSeriesData,
    totalFlags,
    episodes,
    metaData,
    isLoadingAnalysis,
    isFetching,
    isExporting,
    canExport,
    error,
    onParamChange,
    onResetParams,
    onSeriesChange,
    onChartTypeChange,
    onToggleDetector,
    onSelectEpisode,
    onClearEpisode,
    onRefresh,
    onExport,
  } = useMiningTelemetry();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-indigo-500/30 selection:text-indigo-200 flex flex-col font-sans">
      <Header
        isFetching={isFetching}
        isExporting={isExporting}
        canExport={canExport}
        onRefresh={onRefresh}
        onExport={onExport}
      />

      <div className="flex-1 max-w-[1680px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <TelemetryBanner metaData={metaData} />

        <TelemetryErrorAlert error={error} />

        {isLoadingAnalysis ? (
          <TelemetryLoadingState />
        ) : result ? (
          <DashboardView
            params={params}
            defaultParams={defaultParams}
            availableSeries={availableSeries}
            seriesChoice={seriesChoice}
            result={result}
            selectedSeriesData={selectedSeriesData}
            totalSeriesData={totalSeriesData}
            totalFlags={totalFlags}
            episodes={episodes}
            chartType={chartType}
            visibleDetectors={visibleDetectors}
            highlightedEpisode={highlightedEpisode}
            isUpdating={isFetching}
            onParamChange={onParamChange}
            onResetParams={onResetParams}
            onSeriesChange={onSeriesChange}
            onChartTypeChange={onChartTypeChange}
            onToggleDetector={onToggleDetector}
            onSelectEpisode={onSelectEpisode}
            onClearEpisode={onClearEpisode}
          />
        ) : (
          <TelemetryEmptyState />
        )}
      </div>
    </div>
  );
}
