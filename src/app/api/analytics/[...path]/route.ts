import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { loadProjectDataset, referencedColumns, TRIAL_COLUMNS } from "@/lib/analytics/dataset";
import { resolveDatasetAccess } from "@/lib/analytics/datasetAuth";
import { streamProjectedRows } from "@/lib/analytics/datasetStore";
import { applyComputedColumns, computedInputColumns, type ComputedColumnDef } from "@/lib/analytics/computeColumn";

// Streaming a large rows blob through the function can take a while; keep headroom.
export const maxDuration = 300;

type Ctx = { params: Promise<{ path: string[] }> };

interface ProxyBody {
  projectId?: string;
  datasetId?: string;
  variables?: unknown;
  options?: unknown;
  includeTrials?: boolean;
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await ctx.params;
  if (!path?.length) return NextResponse.json({ error: "Missing analysis path" }, { status: 400 });
  const analysisKey = path.join("/");

  const body = (await req.json()) as ProxyBody;
  const { projectId, datasetId, variables, options, includeTrials } = body;

  if (!projectId && !datasetId) {
    return NextResponse.json({ error: "Missing projectId or datasetId" }, { status: 400 });
  }

  const upstream = process.env.ANALYTICS_URL;
  const secret = process.env.ANALYTICS_SHARED_SECRET;
  if (!upstream || !secret) {
    return NextResponse.json(
      { error: "Analytics service not configured (ANALYTICS_URL / ANALYTICS_SHARED_SECRET)" },
      { status: 503 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const vars = variables ?? {};

  // Resolve the source dataset (rows + schema) from either an uploaded Dataset
  // or a neurogauge Project, then project each row down to just the columns this
  // analysis references — keeping the upstream payload small (the analytics VPS
  // has limited RAM and a 50 MB nginx body cap).
  // Project each row down to only the columns this analysis references — keeping the
  // upstream payload small AND (for blob-backed datasets) streaming the rows so a huge
  // blob is never fully held in this function's memory.
  let data: Record<string, unknown>[];

  if (datasetId) {
    const access = await resolveDatasetAccess<{
      ownerId: string;
      projectId: string | null;
      rows: unknown;
      rowsBlobUrl: string | null;
      schema: unknown;
      computedColumns: unknown;
    }>(db, datasetId, user.userId, { rows: true, rowsBlobUrl: true, schema: true, computedColumns: true });
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Dataset not found" : "Forbidden" },
        { status: access.status }
      );
    }
    const schema = (access.dataset.schema ?? {}) as Record<string, unknown>;
    const computed = (access.dataset.computedColumns ?? []) as ComputedColumnDef[];

    // Resolve referenced columns from the (small) schema before touching rows.
    const cols = referencedColumns(vars, new Set(Object.keys(schema)));
    // Blob-backed datasets don't persist materialised computed columns; if the analysis
    // references one, pull in its input columns so it can be re-derived after streaming.
    const referencedComputed = computed.filter((d) => cols.has(d.key));
    const needed = new Set(cols);
    for (const d of referencedComputed) {
      for (const input of computedInputColumns(d)) needed.add(input);
    }

    data = await streamProjectedRows(access.dataset, needed);
    if (referencedComputed.length > 0) {
      data = applyComputedColumns(data, referencedComputed);
    }
  } else {
    // Authorize project access.
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, collaborators: { select: { userId: true } } },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const ok = project.ownerId === user.userId
      || project.collaborators.some((c: { userId: string }) => c.userId === user.userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Trial-level rows (one per trial × 30+ cols) only matter when the analysis
    // references a trial-level column; otherwise build block-level (smaller).
    const needsTrials = includeTrials ?? referencedColumns(vars, TRIAL_COLUMNS).size > 0;
    const dataset = await loadProjectDataset(projectId!, { includeTrials: needsTrials });
    if (!dataset) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const cols = referencedColumns(vars, new Set(Object.keys(dataset.schema)));
    data = cols.size > 0
      ? dataset.rows.map((r) => {
          const projected: Record<string, unknown> = {};
          for (const c of cols) projected[c] = r[c] ?? null;
          return projected;
        })
      : dataset.rows;
  }

  const upstreamPayload = { data, variables: vars, options: options ?? {} };
  const paramsHash = createHash("sha256")
    .update(JSON.stringify(upstreamPayload))
    .digest("hex");

  // Cache key: AnalysisResult rows belong to either a project or a dataset.
  const cacheWhere = datasetId
    ? { datasetId_analysisKey_paramsHash: { datasetId, analysisKey, paramsHash } }
    : { projectId_analysisKey_paramsHash: { projectId: projectId!, analysisKey, paramsHash } };
  const cacheCreate = datasetId
    ? { datasetId, analysisKey, paramsHash }
    : { projectId, analysisKey, paramsHash };

  // Cache lookup
  const cached = await db.analysisResult.findUnique({ where: cacheWhere });
  if (cached) {
    return NextResponse.json({ ...(cached.result as object), cached: true });
  }

  const upstreamRes = await fetch(`${upstream}/v1/${analysisKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Analytics-Key": secret,
    },
    body: JSON.stringify(upstreamPayload),
  });

  const text = await upstreamRes.text();
  if (!upstreamRes.ok) {
    return new NextResponse(text, {
      status: upstreamRes.status,
      headers: { "Content-Type": upstreamRes.headers.get("content-type") ?? "application/json" },
    });
  }

  const result = JSON.parse(text);

  await db.analysisResult.upsert({
    where: cacheWhere,
    create: { ...cacheCreate, result },
    update: { result, createdAt: new Date() },
  });

  return NextResponse.json(result);
}
