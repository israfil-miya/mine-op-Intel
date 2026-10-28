import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getMeta, getAnalysis, getReport } from "@/api";
import { useDebounced } from "@/hooks/useDebounce";
import { INITIAL_PARAMS, DEFAULT_SERIES, DEBOUNCE_DELAY_MS, DETECTOR_NAMES } from "@/constants";
import type { AnalysisParams, AnomalyEpisode, ChartType, DetectorName } from "@/types";

export function useMiningTelemetry() {
  const [params, setParams] = useState<AnalysisParams>(INITIAL_PARAMS);
  const [seriesChoice, setSeriesChoice] = useState(DEFAULT_SERIES);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [visibleDetectors, setVisibleDetectors] = useState<DetectorName[]>(DETECTOR_NAMES);
  const [highlightedEpisode, setHighlightedEpisode] = useState<AnomalyEpisode | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(false);

  const settledParams = useDebounced(params, DEBOUNCE_DELAY_MS);

  const metaQuery = useQuery({
    queryKey: ["meta", refreshToken],
    queryFn: () => getMeta(forceRefresh),
  });

  const availableSeries = useMemo(() => {
    return metaQuery.data?.series ?? [];
  }, [metaQuery.data?.series]);

  useEffect(() => {
    if (availableSeries.length && !availableSeries.includes(seriesChoice)) {
      setSeriesChoice(
        availableSeries.includes(DEFAULT_SERIES) ? DEFAULT_SERIES : availableSeries[0],
      );
    }
  }, [availableSeries, seriesChoice]);

  const analysisQuery = useQuery({
    queryKey: ["analysis", settledParams, availableSeries, refreshToken],
    queryFn: () => getAnalysis(settledParams, availableSeries, forceRefresh),
    enabled: Boolean(metaQuery.data) && availableSeries.length > 0,
  });

  useEffect(() => {
    if (
      forceRefresh &&
      !analysisQuery.isFetching &&
      (analysisQuery.isSuccess || analysisQuery.isError)
    ) {
      setForceRefresh(false);
    }
  }, [forceRefresh, analysisQuery.isError, analysisQuery.isFetching, analysisQuery.isSuccess]);

  const reportMutation = useMutation({
    mutationFn: async () => {
      const reportSeries = chartType === "stacked" ? availableSeries : [seriesChoice];
      const blob = await getReport(settledParams, chartType, reportSeries, forceRefresh);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `weyland-yutani-mining-report-${seriesChoice.toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });

  const result = analysisQuery.data;
  const selectedSeriesData = result?.series[seriesChoice];
  const totalSeriesData = result?.series[DEFAULT_SERIES] ?? selectedSeriesData;

  const totalFlags = DETECTOR_NAMES.reduce(
    (sum, detector) => sum + (result?.series[DEFAULT_SERIES]?.anomaly_counts?.[detector] ?? 0),
    0,
  );

  const episodes = useMemo(() => {
    const list = [...(result?.anomaly_episodes ?? [])];
    return list.sort((a, b) => (b.severity ?? b.point_count) - (a.severity ?? a.point_count));
  }, [result?.anomaly_episodes]);

  function handleParamChange<K extends keyof AnalysisParams>(key: K, value: AnalysisParams[K]) {
    setParams((current) => ({ ...current, [key]: value }));
  }

  function handleResetParams() {
    setParams(INITIAL_PARAMS);
  }

  function handleToggleDetector(detector: DetectorName) {
    setVisibleDetectors((current) =>
      current.includes(detector)
        ? current.filter((entry) => entry !== detector)
        : [...current, detector],
    );
  }

  function handleSelectEpisode(episode: AnomalyEpisode) {
    const isSameEpisode =
      highlightedEpisode === episode ||
      (highlightedEpisode != null &&
        highlightedEpisode.start_date === episode.start_date &&
        highlightedEpisode.end_date === episode.end_date &&
        (highlightedEpisode.series ?? []).join(",") === (episode.series ?? []).join(","));

    if (isSameEpisode) {
      setHighlightedEpisode(null);
      return;
    }

    setHighlightedEpisode(episode);
    const seriesList = Array.isArray(episode.series) ? episode.series : [];
    if (seriesList[0] && availableSeries.includes(seriesList[0])) {
      setSeriesChoice(seriesList[0]);
    }
  }

  function handleClearEpisode() {
    setHighlightedEpisode(null);
  }

  function handleSelectSeries(series: string) {
    setSeriesChoice(series);
    if (
      highlightedEpisode &&
      Array.isArray(highlightedEpisode.series) &&
      !highlightedEpisode.series.includes(series)
    ) {
      setHighlightedEpisode(null);
    }
  }

  function handleRefresh() {
    setForceRefresh(true);
    setRefreshToken((token) => token + 1);
  }

  function handleExport() {
    reportMutation.mutate();
  }

  const error = metaQuery.error ?? analysisQuery.error ?? reportMutation.error;

  return {
    params,
    defaultParams: INITIAL_PARAMS,
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
    metaData: metaQuery.data,
    isLoadingMeta: metaQuery.isLoading,
    isLoadingAnalysis: analysisQuery.isLoading && !result,
    isFetching: metaQuery.isFetching || analysisQuery.isFetching,
    isExporting: reportMutation.isPending,
    canExport: Boolean(result),
    error,
    onParamChange: handleParamChange,
    onResetParams: handleResetParams,
    onSeriesChange: handleSelectSeries,
    onChartTypeChange: setChartType,
    onToggleDetector: handleToggleDetector,
    onSelectEpisode: handleSelectEpisode,
    onClearEpisode: handleClearEpisode,
    onRefresh: handleRefresh,
    onExport: handleExport,
  };
}
