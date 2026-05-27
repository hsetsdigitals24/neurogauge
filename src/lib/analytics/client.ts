import type { ColumnSchema } from "./dataset";

export interface AnalysisResponse {
  ok: boolean;
  stats: Record<string, unknown>;
  table: { csv: string; headers: string[]; rows: (string | number | null)[][] };
  plots: { type: string; plotly: { data: unknown[]; layout: Record<string, unknown> } }[];
  warnings: string[];
  meta: { n: number; duration_ms: number; version: string };
  cached?: boolean;
}

export interface DatasetResponse {
  rows: Record<string, unknown>[];
  schema: Record<string, ColumnSchema>;
  n: number;
}

export async function fetchDataset(projectId: string, opts: { trials?: boolean } = {}): Promise<DatasetResponse> {
  const qs = opts.trials === false ? "?trials=false" : "";
  const res = await fetch(`/api/projects/${projectId}/analytics/dataset${qs}`);
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  return res.json();
}

export async function runAnalysis(
  analysisKey: string,
  payload: {
    projectId: string;
    data: Record<string, unknown>[];
    variables: Record<string, unknown>;
    options?: Record<string, unknown>;
  }
): Promise<AnalysisResponse> {
  const res = await fetch(`/api/analytics/${analysisKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Analysis failed: ${res.status}`);
  }
  return res.json();
}
