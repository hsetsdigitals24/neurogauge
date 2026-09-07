import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// GET /api/invites — pending invitations addressed to the caller's email
// (project-collaborator + institution). This makes invites discoverable in the
// dashboard so accepting never depends on the invitation email being delivered.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  // Invite emails are stored lower-cased; the signed-in email may not be, so
  // match case-insensitively.
  const emailWhere = { equals: session.email, mode: "insensitive" as const };

  const [projectInvites, institutionInvites] = await Promise.all([
    db.collaboratorInvite.findMany({
      where: { inviteeEmail: emailWhere, accepted: false },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { name: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    }),
    db.institutionInvite.findMany({
      where: { inviteeEmail: emailWhere, accepted: false },
      orderBy: { createdAt: "desc" },
      include: {
        institution: { select: { name: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  return NextResponse.json({
    projectInvites: projectInvites.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (i: any) => ({
        token: i.token,
        projectName: i.project?.name ?? "a project",
        invitedBy: i.invitedBy?.name ?? i.invitedBy?.email ?? "",
        createdAt: i.createdAt,
      })
    ),
    institutionInvites: institutionInvites.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (i: any) => ({
        token: i.token,
        institutionName: i.institution?.name ?? "an institution",
        role: i.role,
        invitedBy: i.invitedBy?.name ?? i.invitedBy?.email ?? "",
        createdAt: i.createdAt,
      })
    ),
  });
}
