import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { resolveDatasetAccess } from "@/lib/analytics/datasetAuth";
import { deleteRowsBlob, isBlobUrl } from "@/lib/analytics/datasetStore";

type Ctx = { params: Promise<{ id: string }> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

interface DatasetFull {
  ownerId: string;
  projectId: string | null;
  name: string;
  rows: unknown;
  rowsBlobUrl: string | null;
  schema: unknown;
  n: number;
  computedColumns: unknown;
}

// GET /api/datasets/[id] — full dataset for the workbench.
// Small datasets return rows inline; large (blob-backed) ones return `rowsUrl`,
// which the browser fetches directly from Blob (bypasses function response limits).
// Accessible to the owner or any collaborator on the linked project.
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const access = await resolveDatasetAccess<DatasetFull>(db, id, user.userId, {
    name: true, rows: true, rowsBlobUrl: true, schema: true, n: true, computedColumns: true,
  });
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 404 ? "Not found" : "Forbidden" },
      { status: access.status }
    );
  }
  const dataset = access.dataset;

  return NextResponse.json({
    name: dataset.name,
    ...(dataset.rowsBlobUrl
      ? { rowsUrl: dataset.rowsBlobUrl }
      : { rows: dataset.rows ?? [] }),
    schema: dataset.schema,
    n: dataset.n,
    computedColumns: dataset.computedColumns ?? [],
    projectId: dataset.projectId,
  });
}

// PATCH /api/datasets/[id] — persist schema retypes/renames, name, computed columns, rows.
// Owner or collaborator may edit.
export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const access = await resolveDatasetAccess<{ ownerId: string; projectId: string | null; rowsBlobUrl: string | null }>(
    db, id, user.userId, { rowsBlobUrl: true }
  );
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 404 ? "Not found" : "Forbidden" },
      { status: access.status }
    );
  }

  let body: {
    name?: string;
    schema?: Record<string, unknown>;
    rows?: Record<string, unknown>[];
    computedColumns?: unknown[];
    rowsBlobUrl?: string;
    n?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (typeof body.name === "string") data.name = body.name.trim() || "Untitled dataset";
  if (body.schema && typeof body.schema === "object") data.schema = body.schema;
  if (body.computedColumns !== undefined) data.computedColumns = body.computedColumns;
  if (Array.isArray(body.rows)) {
    // Blob-backed datasets never round-trip rows through a function (body-size cap);
    // computed columns are re-applied from their stored definitions on load instead.
    if (access.dataset.rowsBlobUrl) {
      return NextResponse.json(
        { error: "Rows of large (blob-stored) datasets cannot be updated; computed columns are recomputed on load." },
        { status: 400 }
      );
    }
    data.rows = body.rows;
    data.n = body.rows.length;
  }

  // Edited rows of blob-backed datasets are re-uploaded to Blob directly from
  // the browser; the PATCH carries only the new URL (+ row count).
  let oldRowsBlobUrl: string | null = null;
  if (typeof body.rowsBlobUrl === "string") {
    if (!access.dataset.rowsBlobUrl) {
      return NextResponse.json(
        { error: "rowsBlobUrl is only valid for blob-stored datasets." },
        { status: 400 }
      );
    }
    if (!isBlobUrl(body.rowsBlobUrl)) {
      return NextResponse.json({ error: "Invalid rowsBlobUrl" }, { status: 400 });
    }
    data.rowsBlobUrl = body.rowsBlobUrl;
    if (typeof body.n === "number" && Number.isInteger(body.n) && body.n >= 0) data.n = body.n;
    if (body.rowsBlobUrl !== access.dataset.rowsBlobUrl) {
      oldRowsBlobUrl = access.dataset.rowsBlobUrl;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await db.dataset.update({
    where: { id },
    data,
    select: { id: true, name: true, n: true },
  });

  if (oldRowsBlobUrl) await deleteRowsBlob(oldRowsBlobUrl);

  // Data or schema changed — drop now-orphaned cached analysis results.
  // (paramsHash already prevents stale hits; this just stops dead rows accumulating.)
  if (data.rows !== undefined || data.schema !== undefined || data.rowsBlobUrl !== undefined) {
    await db.analysisResult.deleteMany({ where: { datasetId: id } }).catch(() => {});
  }

  return NextResponse.json(updated);
}

// DELETE /api/datasets/[id]
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await db.dataset.findUnique({
    where: { id },
    select: { ownerId: true, rowsBlobUrl: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.ownerId !== user.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.dataset.delete({ where: { id } });
  await deleteRowsBlob(existing.rowsBlobUrl);
  return NextResponse.json({ ok: true });
}
