import type { ColumnSchema } from "./dataset";
import { applyComputedColumns, type ComputedColumnDef } from "./computeColumn";

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
  name?: string;
  computedColumns?: unknown[];
  projectId?: string | null;
  /** False for large blob-backed datasets: rows are never PATCHed back (computed
   *  columns are re-applied from their definitions on load instead). */
  rowsPersisted?: boolean;
}

/** Where an analysis pulls its data from: a neurogauge project or an uploaded dataset. */
export type AnalysisSource =
  | { kind: "project"; projectId: string }
  | { kind: "dataset"; datasetId: string };

export async function fetchDataset(projectId: string, opts: { trials?: boolean } = {}): Promise<DatasetResponse> {
  const qs = opts.trials === false ? "?trials=false" : "";
  const res = await fetch(`/api/projects/${projectId}/analytics/dataset${qs}`);
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchDatasetById(id: string): Promise<DatasetResponse> {
  const res = await fetch(`/api/datasets/${id}`);
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  const data = await res.json();

  // Large datasets store rows in Blob; the browser fetches them directly
  // (bypasses function response limits) and re-applies computed columns.
  if (data.rowsUrl) {
    const rowsRes = await fetch(data.rowsUrl);
    if (!rowsRes.ok) throw new Error(`Dataset rows fetch failed: ${rowsRes.status}`);
    const rawRows = (await rowsRes.json()) as Record<string, unknown>[];
    const defs = (data.computedColumns ?? []) as ComputedColumnDef[];
    return { ...data, rows: applyComputedColumns(rawRows, defs), rowsPersisted: false };
  }

  return { ...data, rowsPersisted: true };
}

export async function runAnalysis(
  analysisKey: string,
  payload: {
    projectId?: string;
    datasetId?: string;
    variables: Record<string, unknown>;
    options?: Record<string, unknown>;
    includeTrials?: boolean;
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
