import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ token: string }> };

// GET /api/institution-invites/[token] — public invite info for the accept page.
export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invite = await (prisma as any).institutionInvite.findUnique({
    where: { token },
    include: { institution: { select: { name: true } } },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  return NextResponse.json({
    institutionName: invite.institution.name,
    inviteeEmail: invite.inviteeEmail,
    accepted: invite.accepted,
  });
}

// POST /api/institution-invites/[token] — accept the invite; adds the signed-in
// user as a member with the invited role.
export async function POST(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const invite = await db.institutionInvite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.accepted) return NextResponse.json({ error: "Invite already accepted" }, { status: 409 });

  if (invite.inviteeEmail.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  await db.$transaction([
    db.institutionMember.upsert({
      where: { institutionId_userId: { institutionId: invite.institutionId, userId: session.userId } },
      create: { institutionId: invite.institutionId, userId: session.userId, role: invite.role },
      update: {},
    }),
    db.institutionInvite.update({ where: { token }, data: { accepted: true } }),
  ]);

  return NextResponse.json({ ok: true, institutionId: invite.institutionId });
}
