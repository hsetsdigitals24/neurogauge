import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { loadProjectDataset } from "@/lib/analytics/dataset";

type Ctx = { params: Promise<{ path: string[] }> };

interface ProxyBody {
  projectId?: string;
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
  const { projectId, variables, options, includeTrials } = body;

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const upstream = process.env.ANALYTICS_URL;
  const secret = process.env.ANALYTICS_SHARED_SECRET;
  if (!upstream || !secret) {
    return NextResponse.json(
      { error: "Analytics service not configured (ANALYTICS_URL / ANALYTICS_SHARED_SECRET)" },
      { status: 503 }
    );
  }

  // Authorize project access.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, collaborators: { select: { userId: true } } },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const ok = project.ownerId === user.userId
    || project.collaborators.some((c: { userId: string }) => c.userId === user.userId);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Rebuild the dataset server-side so the browser never has to upload it (avoids
  // nginx 413s on large projects). includeTrials defaults to true, matching the
  // dataset the workbench form loads for its column dropdowns.
  const dataset = await loadProjectDataset(projectId, { includeTrials: includeTrials ?? true });
  if (!dataset) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const upstreamPayload = { data: dataset.rows, variables: variables ?? {}, options: options ?? {} };
  const paramsHash = createHash("sha256")
    .update(JSON.stringify(upstreamPayload))
    .digest("hex");

  // Cache lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cached = await (prisma as any).analysisResult.findUnique({
    where: { projectId_analysisKey_paramsHash: { projectId, analysisKey, paramsHash } },
  });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).analysisResult.upsert({
    where: { projectId_analysisKey_paramsHash: { projectId, analysisKey, paramsHash } },
    create: { projectId, analysisKey, paramsHash, result },
    update: { result, createdAt: new Date() },
  });

  return NextResponse.json(result);
}
