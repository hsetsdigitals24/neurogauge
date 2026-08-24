import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// GET /api/dashboard — supervisor/aggregate rollup of the caller's own projects
// and collection sites. Aggregates lightweight session facts server-side; never
// loads answers/trials.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const userId = session.userId;

  const [projects, sites] = await Promise.all([
    db.project.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true, config: true, createdAt: true },
    }),
    db.site.findMany({
      where: { userId },
      select: { id: true, name: true, code: true, location: true, principalInvestigator: true },
    }),
  ]);

  const projectIds = projects.map((p: { id: string }) => p.id);
  const sessions = projectIds.length
    ? await db.testSession.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          id: true,
          projectId: true,
          siteId: true,
          finishedAt: true,
          createdAt: true,
          project: { select: { name: true } },
          site: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const isDone = (s: { finishedAt: Date | null }) => !!s.finishedAt;

  // Per-project rollup
  const perProject = projects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => {
      const rows = sessions.filter((s: { projectId: string }) => s.projectId === p.id);
      const siteIds = new Set(
        rows.map((s: { siteId: string | null }) => s.siteId).filter(Boolean)
      );
      const lastActivity = rows.length ? rows[0].createdAt : null; // sessions are createdAt desc
      const kind =
        p.config && typeof p.config === "object" && p.config.kind === "questionnaire"
          ? "questionnaire"
          : "nback";
      return {
        id: p.id,
        name: p.name,
        kind,
        participants: rows.length,
        completed: rows.filter(isDone).length,
        siteCount: siteIds.size,
        lastActivity,
        createdAt: p.createdAt,
      };
    })
    .sort(
      (a: { participants: number }, b: { participants: number }) =>
        b.participants - a.participants
    );

  // Per-site rollup
  const perSite = sites
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((site: any) => {
      const rows = sessions.filter((s: { siteId: string | null }) => s.siteId === site.id);
      const projIds = new Set(rows.map((s: { projectId: string }) => s.projectId));
      return {
        id: site.id,
        name: site.name,
        code: site.code,
        location: site.location,
        principalInvestigator: site.principalInvestigator,
        participants: rows.length,
        completed: rows.filter(isDone).length,
        projectCount: projIds.size,
      };
    })
    .sort(
      (a: { participants: number }, b: { participants: number }) =>
        b.participants - a.participants
    );

  const unassigned = sessions.filter((s: { siteId: string | null }) => !s.siteId).length;

  // 30-day collection timeline (UTC day buckets)
  const timeline: { date: string; count: number }[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  const startUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(startUtc - i * dayMs).toISOString().slice(0, 10);
    buckets.set(d, 0);
  }
  for (const s of sessions) {
    const d = new Date(s.createdAt).toISOString().slice(0, 10);
    if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }
  for (const [date, count] of buckets) timeline.push({ date, count });

  // Recent activity — last 12 submissions
  const recent = sessions.slice(0, 12).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => ({
      id: s.id,
      projectName: s.project?.name ?? null,
      siteName: s.site?.name ?? null,
      siteCode: s.site?.code ?? null,
      completed: isDone(s),
      createdAt: s.createdAt,
    })
  );

  return NextResponse.json({
    totals: {
      projects: projects.length,
      sites: sites.length,
      participants: sessions.length,
      completed: sessions.filter(isDone).length,
    },
    perProject,
    perSite,
    unassigned,
    timeline,
    recent,
  });
}
