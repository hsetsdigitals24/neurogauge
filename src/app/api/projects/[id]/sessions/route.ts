import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({
    where: { id },
    select: { ownerId: true, collaborators: { select: { userId: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = project.ownerId === session.userId;
  const isCollab = project.collaborators.some(
    (c: { userId: string }) => c.userId === session.userId
  );
  if (!isOwner && !isCollab) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await db.testSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: {
      blocks: {
        orderBy: { blockIndex: "asc" },
        include: { trials: true },
      },
    },
  });

  return NextResponse.json(sessions);
}
