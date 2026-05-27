import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ path: string[] }> };

interface ProxyBody {
  projectId?: string;
  data: unknown;
  variables?: unknown;
  options?: unknown;
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await ctx.params;
  if (!path?.length) return NextResponse.json({ error: "Missing analysis path" }, { status: 400 });
  const analysisKey = path.join("/");

  const body = (await req.json()) as ProxyBody;
  const { projectId, data, variables, options } = body;

  const upstream = process.env.ANALYTICS_URL;
  const secret = process.env.ANALYTICS_SHARED_SECRET;
  if (!upstream || !secret) {
    return NextResponse.json(
      { error: "Analytics service not configured (ANALYTICS_URL / ANALYTICS_SHARED_SECRET)" },
      { status: 503 }
    );
  }

  // Authorize project access when projectId provided.
  if (projectId) {
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
  }

  const upstreamPayload = { data, variables: variables ?? {}, options: options ?? {} };
  const paramsHash = createHash("sha256")
    .update(JSON.stringify(upstreamPayload))
    .digest("hex");

  // Cache lookup (only when scoped to a project)
  if (projectId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = await (prisma as any).analysisResult.findUnique({
      where: { projectId_analysisKey_paramsHash: { projectId, analysisKey, paramsHash } },
    });
    if (cached) {
      return NextResponse.json({ ...(cached.result as object), cached: true });
    }
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

  if (projectId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).analysisResult.upsert({
      where: { projectId_analysisKey_paramsHash: { projectId, analysisKey, paramsHash } },
      create: { projectId, analysisKey, paramsHash, result },
      update: { result, createdAt: new Date() },
    });
  }

  return NextResponse.json(result);
}
