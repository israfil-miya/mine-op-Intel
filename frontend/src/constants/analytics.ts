import type { AnalysisParams } from "@/types";

export const INITIAL_PARAMS: AnalysisParams = {
  basis: "raw",
  trend_degree: 2,
  iqr_k: 1.5,
  z_threshold: 3,
  ma_window: 7,
  ma_threshold_pct: 25,
  ma_centered: false,
  grubbs_alpha: 0.05,
};

export const DEFAULT_SERIES = "Total";
export const DEBOUNCE_DELAY_MS = 250;

export const TREND_DEGREE_OPTIONS = [
  { value: 1, label: "Degree 1 (Linear)" },
  { value: 2, label: "Degree 2 (Quadratic)" },
  { value: 3, label: "Degree 3 (Cubic)" },
  { value: 4, label: "Degree 4 (Quartic)" },
] as const;

export const SLIDER_CONFIGS = {
  iqr_k: { min: 0.5, max: 4.0, step: 0.1 },
  z_threshold: { min: 1.0, max: 5.0, step: 0.1 },
  ma_window: { min: 3, max: 30, step: 1 },
  ma_threshold_pct: { min: 5, max: 100, step: 1 },
  grubbs_alpha: { min: 0.01, max: 0.1, step: 0.01 },
} as const;
