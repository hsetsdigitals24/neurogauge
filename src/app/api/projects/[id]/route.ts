import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

async function getProjectAndCheckAccess(id: string, userId: string, ownerOnly = false) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = await (prisma as any).project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      collaborators: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      invites: true,
    },
  });
  if (!project) return { project: null, authorized: false };
  const isOwner = project.ownerId === userId;
  const isCollab = project.collaborators.some(
    (c: { userId: string }) => c.userId === userId
  );
  if (ownerOnly && !isOwner) return { project, authorized: false };
  return { project, authorized: isOwner || isCollab };
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { project, authorized } = await getProjectAndCheckAccess(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ project, isOwner: project.ownerId === session.userId });
}

export async function PUT(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { project, authorized } = await getProjectAndCheckAccess(id, session.userId, true);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma as any).project.update({
    where: { id },
    data: {
      name: body.name ?? project.name,
      config: body.config ?? project.config,
    },
    select: { id: true, name: true, shareToken: true, config: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { project, authorized } = await getProjectAndCheckAccess(id, session.userId, true);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
