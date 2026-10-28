export type DetectorName = "iqr" | "z_score" | "moving_average" | "grubbs";
export type Basis = "raw" | "adjusted";
export type ChartType = "line" | "bar" | "stacked";

export interface DashboardMeta {
  title: string;
  source: string;
  row_count: number;
  date_column: string;
  date_range: { start: string; end: string };
  series: string[];
  cache_ttl_seconds: number;
}

export interface Statistics {
  count: number;
  mean: number | null;
  median: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  sum: number | null;
  q1: number | null;
  q3: number | null;
}

export interface AnomalyRecord {
  index: number;
  date: string;
  value: number;
  observed_value: number | null;
  direction: "high" | "low";
}

export interface SeriesAnalysis {
  statistics: Statistics;
  trend: { degree: number; coefficients: number[]; values: (number | null)[] };
  anomalies: Record<DetectorName, AnomalyRecord[]>;
  anomaly_counts: Record<DetectorName, number>;
}

export interface AnalysisPoint {
  index: number;
  date: string;
  series: string;
  value: number | null;
  adjusted_value: number | null;
  analysis_value: number | null;
  trend_value: number | null;
}

export interface AnomalyEpisode {
  start_date: string;
  end_date: string;
  peak_date?: string;
  direction?: "spike" | "drop" | "high" | "low";
  series: string[];
  detectors: string[];
  point_count: number;
  severity?: number;
  observed?: number | null;
  expected?: number | null;
  deviation_pct?: number | null;
}

export interface AnalysisResponse {
  basis: Basis;
  date_column: string;
  dates: string[];
  series: Record<string, SeriesAnalysis>;
  points: AnalysisPoint[];
  anomaly_episodes: AnomalyEpisode[];
}

export interface AnalysisParams {
  basis: Basis;
  trend_degree: number;
  iqr_k: number;
  z_threshold: number;
  ma_window: number;
  ma_threshold_pct: number;
  ma_centered: boolean;
  grubbs_alpha: number;
}
