import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { parseCsv } from "@/lib/analytics/csvParser";
import { sanitiseHeaders, inferSchema, remapRows } from "@/lib/analytics/csvIngest";
import { storeRows, deleteRowsBlob, isBlobUrl } from "@/lib/analytics/datasetStore";

// Guards: the ingest function must parse the whole CSV, and the analytics VPS
// (1.6 GB RAM) is the eventual compute ceiling. Large files arrive via Vercel
// Blob (client-direct upload), small ones inline as csvText.
const MAX_CSV_BYTES = 100 * 1024 * 1024; // 100 MB raw CSV
const MAX_ROWS = 1_000_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// POST /api/datasets — create a dataset from uploaded CSV.
// Body: { name, projectId?, csvText } (small files) or { name, projectId?, blobUrl } (large files
// already uploaded to Vercel Blob via /api/datasets/blob-upload).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; csvText?: string; blobUrl?: string; projectId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim() || "Untitled dataset";

  let csvText = body.csvText ?? "";
  const blobUrl = body.blobUrl ?? "";

  if (blobUrl) {
    if (!isBlobUrl(blobUrl)) {
      return NextResponse.json({ error: "Invalid upload URL" }, { status: 400 });
    }
    const res = await fetch(blobUrl);
    if (!res.ok) {
      return NextResponse.json({ error: `Could not read uploaded file (${res.status})` }, { status: 400 });
    }
    csvText = await res.text();
  }

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
  const rows = remapRows(rawRows, columns, headers);
  const schema = inferSchema(rows, columns);

  // Inline small row sets; push large ones to Blob.
  let stored: Awaited<ReturnType<typeof storeRows>>;
  try {
    stored = await storeRows(rows);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to store dataset rows" },
      { status: 503 }
    );
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
      rows: stored.rows ?? undefined,
      rowsBlobUrl: stored.rowsBlobUrl,
      computedColumns: [],
      n: rows.length,
    },
    select: { id: true, name: true, n: true, projectId: true },
  });

  // The raw-CSV blob was only a transport vehicle; the processed rows are what we keep.
  if (blobUrl) await deleteRowsBlob(blobUrl);

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
