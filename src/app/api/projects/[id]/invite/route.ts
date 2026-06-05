import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendMail, collaboratorInviteEmail } from "@/lib/mail";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { email: rawEmail } = await req.json();
  if (!rawEmail) return NextResponse.json({ error: "Email required" }, { status: 400 });
  const email = String(rawEmail).toLowerCase().trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({
    where: { id },
    include: { owner: { select: { name: true, email: true } } },
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

  // Reuse pending invite if present but refresh its token so a fresh link is sent.
  const existing = await db.collaboratorInvite.findFirst({
    where: { projectId: id, inviteeEmail: email, accepted: false },
  });

  const invite = existing
    ? await db.collaboratorInvite.update({
        where: { id: existing.id },
        data: { token: randomUUID(), invitedById: session.userId },
      })
    : await db.collaboratorInvite.create({
        data: { projectId: id, inviteeEmail: email, invitedById: session.userId },
      });

  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  let origin = envBase;
  if (!origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    origin = host ? `${proto}://${host}` : new URL(req.url).origin;
  }
  const inviteLink = `${origin}/invites/${invite.token}`;

  let emailSent = false;
  let emailError: string | null = null;
  try {
    const { html, text } = collaboratorInviteEmail(
      inviteLink,
      project.name,
      project.owner?.name ?? project.owner?.email ?? ""
    );
    await sendMail({
      to: email,
      subject: `You've been invited to collaborate on "${project.name}"`,
      html,
      text,
    });
    emailSent = true;
  } catch (e: unknown) {
    const rawMessage = (e as { message?: string })?.message ?? "Failed to send invite email";
    console.error("Invite email failed:", rawMessage);
    if (rawMessage.startsWith("SMTP not configured")) {
      emailError = "Email is not configured on this server.";
    } else {
      emailError = rawMessage.split("\n")[0].slice(0, 200);
    }
  }

  return NextResponse.json({ invite, inviteLink, emailSent, emailError });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const inviteId = new URL(req.url).searchParams.get("inviteId");
  if (!inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({ where: { id }, select: { ownerId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.ownerId !== session.userId) {
    return NextResponse.json({ error: "Only owners can cancel invites" }, { status: 403 });
  }

  const invite = await db.collaboratorInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.projectId !== id) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.accepted) {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 409 });
  }

  await db.collaboratorInvite.delete({ where: { id: inviteId } });
  return NextResponse.json({ ok: true });
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
