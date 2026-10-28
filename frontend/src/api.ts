import type { AnalysisParams, AnalysisResponse, DashboardMeta } from "./types";

async function expectOk(response: Response): Promise<Response> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (${response.status})`);
  }
  return response;
}

export async function getMeta(refresh: boolean): Promise<DashboardMeta> {
  const response = await expectOk(await fetch(`/api/meta${refresh ? "?refresh=true" : ""}`));
  return (await response.json()) as DashboardMeta;
}

export async function getAnalysis(
  params: AnalysisParams,
  series: string[],
  refresh: boolean,
): Promise<AnalysisResponse> {
  const query = new URLSearchParams();
  query.set("basis", params.basis);
  query.set("trend_degree", String(params.trend_degree));
  query.set("iqr_k", String(params.iqr_k));
  query.set("z_threshold", String(params.z_threshold));
  query.set("ma_window", String(params.ma_window));
  query.set("ma_threshold_pct", String(params.ma_threshold_pct));
  query.set("ma_centered", String(params.ma_centered));
  query.set("grubbs_alpha", String(params.grubbs_alpha));
  series.forEach((name) => query.append("series", name));
  if (refresh) query.set("refresh", "true");
  const response = await expectOk(await fetch(`/api/analysis?${query.toString()}`));
  return (await response.json()) as AnalysisResponse;
}

export async function getReport(
  params: AnalysisParams,
  chartType: "line" | "bar" | "stacked" | "scatter",
  series: string[],
  refresh: boolean,
): Promise<Blob> {
  const query = new URLSearchParams();
  query.set("basis", params.basis);
  query.set("trend_degree", String(params.trend_degree));
  query.set("chart_type", chartType);
  query.set("iqr_k", String(params.iqr_k));
  query.set("z_threshold", String(params.z_threshold));
  query.set("ma_window", String(params.ma_window));
  query.set("ma_threshold_pct", String(params.ma_threshold_pct));
  query.set("ma_centered", String(params.ma_centered));
  query.set("grubbs_alpha", String(params.grubbs_alpha));
  series.forEach((name) => query.append("series", name));
  if (refresh) query.set("refresh", "true");
  const response = await expectOk(await fetch(`/api/report?${query.toString()}`));
  return response.blob();
}
