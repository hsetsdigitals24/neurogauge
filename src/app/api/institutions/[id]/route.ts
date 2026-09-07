import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMembership } from "@/lib/institution";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/institutions/[id] — the institution dashboard for a member: its
// members, pending invites (managers only), and the projects it co-works on with
// each project scoped to THIS institution's own site data only.
export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const membership = await getMembership(db, id, session.userId);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isManager = membership.role === "owner" || membership.role === "admin";

  const institution = await db.institution.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      projectLinks: {
        include: {
          project: { select: { id: true, name: true, shareToken: true, config: true } },
          site: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
  if (!institution) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Own-site data scope: only sessions collected at each link's assigned site.
  const siteIds = institution.projectLinks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((l: any) => l.siteId)
    .filter(Boolean);
  const projectIds = institution.projectLinks.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (l: any) => l.projectId
  );

  const sessions =
    siteIds.length && projectIds.length
      ? await db.testSession.findMany({
          where: { projectId: { in: projectIds }, siteId: { in: siteIds } },
          select: { projectId: true, siteId: true, finishedAt: true, createdAt: true },
        })
      : [];

  const projects = institution.projectLinks.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any) => {
      const rows = link.siteId
        ? sessions.filter(
            (s: { projectId: string; siteId: string | null }) =>
              s.projectId === link.projectId && s.siteId === link.siteId
          )
        : [];
      const completed = rows.filter(
        (s: { finishedAt: Date | null }) => !!s.finishedAt
      ).length;
      const lastActivity = rows.reduce(
        (acc: Date | null, s: { createdAt: Date }) =>
          !acc || s.createdAt > acc ? s.createdAt : acc,
        null as Date | null
      );
      const cfg = link.project.config;
      const kind =
        cfg && typeof cfg === "object" && cfg.kind === "questionnaire"
          ? "questionnaire"
          : "nback";
      return {
        linkId: link.id,
        projectId: link.project.id,
        projectName: link.project.name,
        shareToken: link.project.shareToken,
        kind,
        site: link.site
          ? { id: link.site.id, name: link.site.name, code: link.site.code }
          : null,
        participants: rows.length,
        completed,
        lastActivity,
      };
    }
  );

  const invites = isManager
    ? await db.institutionInvite.findMany({
        where: { institutionId: id, accepted: false },
        orderBy: { createdAt: "desc" },
        select: { id: true, inviteeEmail: true, role: true, createdAt: true },
      })
    : [];

  return NextResponse.json({
    institution: {
      id: institution.id,
      name: institution.name,
      code: institution.code,
      createdAt: institution.createdAt,
    },
    myRole: membership.role,
    isManager,
    members: institution.members.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        isSelf: m.user.id === session.userId,
      })
    ),
    invites,
    projects,
    totals: {
      projects: projects.length,
      participants: projects.reduce(
        (a: number, p: { participants: number }) => a + p.participants,
        0
      ),
      completed: projects.reduce(
        (a: number, p: { completed: number }) => a + p.completed,
        0
      ),
    },
  });
}

// DELETE /api/institutions/[id] — owner only. Removes the institution (cascades
// members, invites, project links).
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const membership = await getMembership(db, id, session.userId);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can delete this institution" }, { status: 403 });
  }

  await db.institution.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
