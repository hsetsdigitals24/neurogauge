import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const invite = await db.collaboratorInvite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.accepted) return NextResponse.json({ error: "Invite already accepted" }, { status: 409 });

  // Check the logged-in user's email matches (optional but good security)
  if (invite.inviteeEmail.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  // Create collaborator and mark invite accepted
  await db.$transaction([
    db.projectCollaborator.upsert({
      where: { projectId_userId: { projectId: invite.projectId, userId: session.userId } },
      create: { projectId: invite.projectId, userId: session.userId },
      update: {},
    }),
    db.collaboratorInvite.update({ where: { token }, data: { accepted: true } }),
  ]);

  return NextResponse.json({ ok: true, projectId: invite.projectId });
}

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invite = await (prisma as any).collaboratorInvite.findUnique({
    where: { token },
    include: { project: { select: { name: true } } },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  return NextResponse.json({
    projectName: invite.project.name,
    inviteeEmail: invite.inviteeEmail,
    accepted: invite.accepted,
  });
}
