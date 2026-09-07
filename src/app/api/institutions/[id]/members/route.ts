import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMembership, canManage } from "@/lib/institution";
import { sendMail, institutionInviteEmail } from "@/lib/mail";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/institutions/[id]/members — invite a colleague to the institution by
// email (managers only). Creates/refreshes a pending InstitutionInvite + emails a
// join link.
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { email: rawEmail, role } = await req.json();
  if (!rawEmail) return NextResponse.json({ error: "Email required" }, { status: 400 });
  const email = String(rawEmail).toLowerCase().trim();
  const inviteRole = role === "admin" ? "admin" : "member";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const membership = await getMembership(db, id, session.userId);
  if (!membership || !canManage(membership.role)) {
    return NextResponse.json({ error: "Only owners/admins can invite members" }, { status: 403 });
  }

  const institution = await db.institution.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!institution) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already a member?
  const inviteeUser = await db.user.findUnique({ where: { email } });
  if (inviteeUser) {
    const existingMember = await getMembership(db, id, inviteeUser.id);
    if (existingMember) {
      return NextResponse.json({ error: "That person is already a member" }, { status: 409 });
    }
  }

  const existing = await db.institutionInvite.findFirst({
    where: { institutionId: id, inviteeEmail: email, accepted: false },
  });
  const invite = existing
    ? await db.institutionInvite.update({
        where: { id: existing.id },
        data: { token: randomUUID(), invitedById: session.userId, role: inviteRole },
      })
    : await db.institutionInvite.create({
        data: {
          institutionId: id,
          inviteeEmail: email,
          role: inviteRole,
          invitedById: session.userId,
        },
      });

  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  let origin = envBase;
  if (!origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    origin = host ? `${proto}://${host}` : new URL(req.url).origin;
  }
  const inviteLink = `${origin}/institution-invites/${invite.token}`;

  let emailSent = false;
  let emailError: string | null = null;
  try {
    const inviter = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    const { html, text } = institutionInviteEmail(
      inviteLink,
      institution.name,
      inviter?.name ?? inviter?.email ?? ""
    );
    await sendMail({
      to: email,
      subject: `You've been invited to join "${institution.name}" on Neurogauge`,
      html,
      text,
    });
    emailSent = true;
  } catch (e: unknown) {
    const rawMessage = (e as { message?: string })?.message ?? "Failed to send invite email";
    console.error("Institution invite email failed:", rawMessage);
    emailError = rawMessage.startsWith("SMTP not configured")
      ? "Email is not configured on this server."
      : rawMessage.split("\n")[0].slice(0, 200);
  }

  return NextResponse.json({ invite, inviteLink, emailSent, emailError });
}

// DELETE /api/institutions/[id]/members?memberId=... — remove a member. Managers
// can remove others; anyone can remove themselves (leave). The owner cannot be
// removed.
export async function DELETE(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const memberId = new URL(req.url).searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const membership = await getMembership(db, id, session.userId);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const target = await db.institutionMember.findUnique({ where: { id: memberId } });
  if (!target || target.institutionId !== id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "The owner cannot be removed" }, { status: 409 });
  }

  const isSelf = target.userId === session.userId;
  if (!isSelf && !canManage(membership.role)) {
    return NextResponse.json({ error: "Only owners/admins can remove members" }, { status: 403 });
  }

  await db.institutionMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
