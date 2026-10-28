import type { DetectorName } from "@/types";

export const DETECTOR_NAMES: DetectorName[] = ["iqr", "z_score", "moving_average", "grubbs"];

export const DETECTOR_LABELS: Record<DetectorName, string> = {
  iqr: "IQR rule",
  z_score: "Z-score",
  moving_average: "Moving average",
  grubbs: "Grubbs test",
};

export const DETECTOR_COLORS: Record<DetectorName, string> = {
  iqr: "#f97316",
  z_score: "#a855f7",
  moving_average: "#6366f1",
  grubbs: "#eab308",
};

export const CHART_PALETTE = [
  "#6366f1",
  "#38bdf8",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
];
