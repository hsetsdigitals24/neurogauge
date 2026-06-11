/* Storage for uploaded-dataset rows.
 *
 * Small datasets keep their rows inline in the Dataset.rows jsonb column (fast,
 * no extra fetch). Large ones store the rows JSON in Vercel Blob and keep only
 * the URL — Postgres jsonb and Vercel's ~4.5 MB function body cap both make
 * inline storage unworkable at size. Server-side only.
 */

import { put, del } from "@vercel/blob";

/** Rows JSON above this is stored in Blob instead of inline jsonb. */
export const INLINE_ROWS_LIMIT_BYTES = 2 * 1024 * 1024; // 2 MB

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** Persist rows: inline when small, to Blob when large. */
export async function storeRows(
  rows: Record<string, unknown>[]
): Promise<{ rows: Record<string, unknown>[]; rowsBlobUrl: null } | { rows: null; rowsBlobUrl: string }> {
  const json = JSON.stringify(rows);
  if (json.length <= INLINE_ROWS_LIMIT_BYTES) {
    return { rows, rowsBlobUrl: null };
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Dataset is too large for inline storage and Vercel Blob is not configured (BLOB_READ_WRITE_TOKEN)."
    );
  }
  const blob = await put(`datasets/rows/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.json`, json, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true,
  });
  return { rows: null, rowsBlobUrl: blob.url };
}

/** Load rows from wherever they live (inline jsonb or Blob). */
export async function loadDatasetRows(dataset: {
  rows?: unknown;
  rowsBlobUrl?: string | null;
}): Promise<Record<string, unknown>[]> {
  if (Array.isArray(dataset.rows)) return dataset.rows as Record<string, unknown>[];
  if (dataset.rowsBlobUrl && isBlobUrl(dataset.rowsBlobUrl)) {
    const res = await fetch(dataset.rowsBlobUrl);
    if (!res.ok) throw new Error(`Failed to load dataset rows from storage (${res.status})`);
    return (await res.json()) as Record<string, unknown>[];
  }
  return [];
}

/** Best-effort blob cleanup when a dataset is deleted or its rows replaced. */
export async function deleteRowsBlob(url: string | null | undefined): Promise<void> {
  if (!url || !isBlobUrl(url) || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(url);
  } catch {
    // Orphaned blobs are harmless; don't fail the request over cleanup.
  }
}
