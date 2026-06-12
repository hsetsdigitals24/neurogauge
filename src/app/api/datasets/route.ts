import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { parseCsv } from "@/lib/analytics/csvParser";
import { sanitiseHeaders, inferSchema, remapRows } from "@/lib/analytics/csvIngest";
import { storeRows, isBlobUrl } from "@/lib/analytics/datasetStore";

// Guards: the analytics VPS (1.6 GB RAM) is the eventual compute ceiling.
// Large files are parsed in the browser and their rows JSON uploaded
// client-direct to Vercel Blob; the API only receives metadata.
const MAX_CSV_BYTES = 100 * 1024 * 1024; // 100 MB raw CSV
const MAX_ROWS = 1_000_000;

const COLUMN_TYPES = new Set(["numeric", "categorical", "ordinal"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** Validate a client-supplied schema: sanitised keys, known types, string labels. */
function isValidSchema(schema: unknown): schema is Record<string, { type: string; label: string }> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return false;
  const entries = Object.entries(schema as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.every(([key, val]) => {
    if (!/^\w+$/.test(key)) return false; // non-word chars break the formula tokeniser
    if (!val || typeof val !== "object") return false;
    const v = val as { type?: unknown; label?: unknown };
    return typeof v.type === "string" && COLUMN_TYPES.has(v.type) && typeof v.label === "string";
  });
}

// POST /api/datasets — create a dataset.
// Pre-ingested (browser parsed the CSV): { name, projectId?, schema, n, rows | rowsBlobUrl }.
// Legacy small-file path: { name, projectId?, csvText } — parsed server-side.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    csvText?: string;
    projectId?: string;
    schema?: Record<string, unknown>;
    rows?: Record<string, unknown>[];
    rowsBlobUrl?: string;
    n?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim() || "Untitled dataset";

  let schema: Record<string, unknown>;
  let rows: Record<string, unknown>[] | null = null;
  let rowsBlobUrl: string | null = null;
  let n: number;

  const preIngested = body.schema !== undefined && (Array.isArray(body.rows) || typeof body.rowsBlobUrl === "string");

  if (preIngested) {
    if (!isValidSchema(body.schema)) {
      return NextResponse.json({ error: "Invalid schema" }, { status: 400 });
    }
    schema = body.schema!;
    if (Array.isArray(body.rows)) {
      if (body.rows.length === 0) {
        return NextResponse.json({ error: "No data rows found." }, { status: 400 });
      }
      if (body.rows.length > MAX_ROWS) {
        return NextResponse.json(
          { error: `Too many rows (max ${MAX_ROWS.toLocaleString()}).` },
          { status: 400 }
        );
      }
      rows = body.rows;
      n = rows.length;
    } else {
      if (!isBlobUrl(body.rowsBlobUrl!)) {
        return NextResponse.json({ error: "Invalid rows URL" }, { status: 400 });
      }
      if (typeof body.n !== "number" || !Number.isInteger(body.n) || body.n <= 0 || body.n > MAX_ROWS) {
        return NextResponse.json({ error: "Invalid row count" }, { status: 400 });
      }
      rowsBlobUrl = body.rowsBlobUrl!;
      n = body.n;
    }
  } else {
    // Legacy: server-side parse of small inline CSV text.
    const csvText = body.csvText ?? "";
    if (!csvText.trim()) {
      return NextResponse.json({ error: "Missing CSV content" }, { status: 400 });
    }
    if (csvText.length > MAX_CSV_BYTES) {
      return NextResponse.json(
        { error: `CSV too large (max ${Math.round(MAX_CSV_BYTES / 1024 / 1024)} MB).` },
        { status: 400 }
      );
    }

    const { headers, rows: rawRows } = parseCsv(csvText);
    if (headers.length === 0) {
      return NextResponse.json({ error: "File appears empty or has no header row." }, { status: 400 });
    }
    if (rawRows.length === 0) {
      return NextResponse.json({ error: "No data rows found." }, { status: 400 });
    }
    if (rawRows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Too many rows (max ${MAX_ROWS.toLocaleString()}).` },
        { status: 400 }
      );
    }

    const columns = sanitiseHeaders(headers);
    rows = remapRows(rawRows, columns, headers);
    schema = inferSchema(rows, columns);
    n = rows.length;
  }

  // Inline small row sets; push large ones to Blob (no-op when rows came as a blob URL).
  if (rows) {
    let stored: Awaited<ReturnType<typeof storeRows>>;
    try {
      stored = await storeRows(rows);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to store dataset rows" },
        { status: 503 }
      );
    }
    rows = stored.rows;
    rowsBlobUrl = stored.rowsBlobUrl;
  }

  // If a projectId is supplied, only allow linking to a project the user owns
  // or collaborates on; otherwise ignore it (store as standalone).
  let projectId: string | null = null;
  if (body.projectId) {
    const project = await db.project.findUnique({
      where: { id: body.projectId },
      select: { ownerId: true, collaborators: { select: { userId: true } } },
    });
    if (
      project &&
      (project.ownerId === user.userId ||
        project.collaborators.some((c: { userId: string }) => c.userId === user.userId))
    ) {
      projectId = body.projectId;
    }
  }

  const dataset = await db.dataset.create({
    data: {
      ownerId: user.userId,
      projectId,
      name,
      schema,
      rows: rows ?? undefined,
      rowsBlobUrl,
      computedColumns: [],
      n,
    },
    select: { id: true, name: true, n: true, projectId: true },
  });

  return NextResponse.json({ ...dataset, schema }, { status: 201 });
}

// GET /api/datasets — list the current user's datasets.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const datasets = await db.dataset.findMany({
    where: { ownerId: user.userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, n: true, projectId: true, updatedAt: true, createdAt: true },
  });

  return NextResponse.json({ datasets });
}
