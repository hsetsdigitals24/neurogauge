import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { buildLongDataset, dedupeSessions } from "@/lib/analytics/dataset";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const includeTrials = searchParams.get("trials") !== "false";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({
    where: { id },
    select: {
      ownerId: true,
      config: true,
      collaborators: { select: { userId: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = project.ownerId === user.userId;
  const isCollab = project.collaborators.some((c: { userId: string }) => c.userId === user.userId);
  if (!isOwner && !isCollab) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessionsRaw = await db.testSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: {
      blocks: {
        orderBy: { blockIndex: "asc" },
        include: includeTrials
          ? { trials: { orderBy: { trialIndex: "asc" } } }
          : undefined,
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = dedupeSessions(sessionsRaw as any[]).reverse();

  const customQuestions: { id: string; prompt: string }[] = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((project.config as any)?.customQuestions ?? []) as any[]
  ).map((q) => ({ id: String(q.id), prompt: String(q.prompt ?? q.id) }));

  const { rows, schema } = buildLongDataset(sessions, customQuestions, { includeTrials });

  return NextResponse.json({ rows, schema, n: rows.length });
}
