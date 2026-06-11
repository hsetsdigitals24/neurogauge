/* Client-side helper to create a dataset from a CSV file.
 *
 * Small files post their text inline. Large files are uploaded from the
 * browser DIRECTLY to Vercel Blob (client upload — bypasses the ~4.5 MB
 * function request-body cap) and only the blob URL is sent to the API.
 */

import { upload } from "@vercel/blob/client";

/** Files at or above this size go via Blob client upload. */
export const INLINE_UPLOAD_LIMIT_BYTES = 3 * 1024 * 1024; // 3 MB

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
  const name = file.name.replace(/\.csv$/i, "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = { name };
  if (opts.projectId) body.projectId = opts.projectId;

  if (file.size < INLINE_UPLOAD_LIMIT_BYTES) {
    body.csvText = await file.text();
  } else {
    const blob = await upload(`datasets/raw/${file.name}`, file, {
      access: "public",
      handleUploadUrl: "/api/datasets/blob-upload",
      contentType: "text/csv",
      onUploadProgress: (p) => opts.onProgress?.(p.percentage),
    });
    body.blobUrl = blob.url;
  }

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
