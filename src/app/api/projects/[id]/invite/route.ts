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

  const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/invites/${invite.token}`;

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
    emailError = (e as { message?: string })?.message ?? "Failed to send invite email";
    console.error("Invite email failed:", emailError);
  }

  return NextResponse.json({ invite, inviteLink, emailSent, emailError });
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
