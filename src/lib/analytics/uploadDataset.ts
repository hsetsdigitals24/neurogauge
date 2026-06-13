/* Client-side helper to create a dataset from a CSV file.
 *
 * The CSV is parsed IN THE BROWSER (parseCsv/csvIngest are pure TS) so the
 * server never has to relay file content. Small row sets go inline in the
 * POST body; large ones are uploaded from the browser DIRECTLY to Vercel
 * Blob (client upload — bypasses the ~4.5 MB function request-body cap and
 * retries robustly), after which only the blob URL + schema metadata are
 * sent to the API.
 */

import { upload } from "@vercel/blob/client";
import { parseCsv } from "./csvParser";
import { sanitiseHeaders, inferSchema, remapRows } from "./csvIngest";
import { readWorkbook } from "./spreadsheetParser";
import type { ColumnSchema } from "./dataset";

export const MAX_CSV_BYTES = 100 * 1024 * 1024; // 100 MB raw CSV
export const MAX_ROWS = 1_000_000;
/** Rows JSON below this goes inline in the POST body (well under the body cap). */
const INLINE_ROWS_JSON_LIMIT_BYTES = 2 * 1024 * 1024; // 2 MB

export interface CreatedDataset {
  id: string;
  name: string;
  n: number;
  projectId: string | null;
}

export async function uploadCsvAsDataset(
  file: File,
  opts: { projectId?: string | null; onProgress?: (percent: number) => void } = {}
): Promise<CreatedDataset> {
  if (file.size > MAX_CSV_BYTES) {
    throw new Error(`CSV too large (max ${Math.round(MAX_CSV_BYTES / 1024 / 1024)} MB).`);
  }

  const text = await file.text();
  const { headers, rows: rawRows } = parseCsv(text);
  const { schema, rows } = ingest(headers, rawRows);
  const name = stripDatasetExtension(file.name);
  return finishUpload(name, schema, rows, opts);
}

/**
 * Create a dataset from one sheet of an Excel/ODS workbook. The file is parsed
 * IN THE BROWSER (SheetJS); only parsed rows + schema reach the server — the
 * raw spreadsheet is never uploaded.
 */
export async function uploadSheetAsDataset(
  file: File,
  sheetName: string,
  opts: { projectId?: string | null; onProgress?: (percent: number) => void } = {}
): Promise<CreatedDataset> {
  if (file.size > MAX_CSV_BYTES) {
    throw new Error(`File too large (max ${Math.round(MAX_CSV_BYTES / 1024 / 1024)} MB).`);
  }
  const wb = await readWorkbook(file);
  const { headers, rows: rawRows } = wb.parseSheet(sheetName);
  const { schema, rows } = ingest(headers, rawRows);
  const name = stripDatasetExtension(file.name);
  return finishUpload(name, schema, rows, opts);
}

function stripDatasetExtension(fileName: string): string {
  return fileName.replace(/\.(csv|xlsx?|xlsm|ods)$/i, "");
}

/** Sanitise + schema-infer parsed `{ headers, rows }` (shared by CSV + Excel). */
function ingest(
  headers: string[],
  rawRows: Record<string, unknown>[]
): { schema: Record<string, ColumnSchema>; rows: Record<string, unknown>[] } {
  if (headers.length === 0) throw new Error("File appears empty or has no header row.");
  if (rawRows.length === 0) throw new Error("No data rows found.");
  if (rawRows.length > MAX_ROWS) {
    throw new Error(`Too many rows (max ${MAX_ROWS.toLocaleString()}).`);
  }
  const columns = sanitiseHeaders(headers);
  const rows = remapRows(rawRows, columns, headers);
  const schema = inferSchema(rows, columns);
  return { schema, rows };
}

/** Send parsed rows + schema to the API, going via Blob when the rows JSON is large. */
async function finishUpload(
  name: string,
  schema: Record<string, ColumnSchema>,
  rows: Record<string, unknown>[],
  opts: { projectId?: string | null; onProgress?: (percent: number) => void }
): Promise<CreatedDataset> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = { name, schema, n: rows.length };
  if (opts.projectId) body.projectId = opts.projectId;

  const rowsJson = JSON.stringify(rows);
  if (rowsJson.length < INLINE_ROWS_JSON_LIMIT_BYTES) {
    body.rows = rows;
  } else {
    const blob = await upload(`datasets/rows/${name}.json`, rowsJson, {
      access: "public",
      handleUploadUrl: "/api/datasets/blob-upload",
      contentType: "application/json",
      onUploadProgress: (p) => opts.onProgress?.(p.percentage),
    });
    body.rowsBlobUrl = blob.url;
  }

  return createDataset(body);
}

/** Re-upload an edited blob-backed dataset's rows JSON directly to Blob
 *  (bypasses the function body cap); returns the new blob URL to PATCH. */
export async function uploadRowsBlob(rows: Record<string, unknown>[]): Promise<string> {
  const blob = await upload("datasets/rows/edited.json", JSON.stringify(rows), {
    access: "public",
    handleUploadUrl: "/api/datasets/blob-upload",
    contentType: "application/json",
  });
  return blob.url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createDataset(body: Record<string, any>): Promise<CreatedDataset> {
  const res = await fetch("/api/datasets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  return res.json();
}
