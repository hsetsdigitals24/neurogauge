import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({
    where: { id },
    include: { owner: { select: { name: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.ownerId !== session.userId) {
    return NextResponse.json({ error: "Only owners can invite" }, { status: 403 });
  }

  // Check if the invitee is already a collaborator
  const inviteeUser = await db.user.findUnique({ where: { email } });
  if (inviteeUser) {
    const existing = await db.projectCollaborator.findUnique({
      where: { projectId_userId: { projectId: id, userId: inviteeUser.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already a collaborator" }, { status: 409 });
    }
  }

  // Upsert invite
  const existing = await db.collaboratorInvite.findFirst({
    where: { projectId: id, inviteeEmail: email, accepted: false },
  });

  const invite = existing
    ? existing
    : await db.collaboratorInvite.create({
        data: { projectId: id, inviteeEmail: email, invitedById: session.userId },
      });

  // In production you'd send an email here with invite.token
  // For now we return the invite link so the user can share it manually
  const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/invites/${invite.token}`;

  return NextResponse.json({ invite, inviteLink });
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({ where: { id }, select: { ownerId: true } });
  if (!project || project.ownerId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await db.collaboratorInvite.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invites);
}
