import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type Ctx = { params: Promise<{ siteId: string }> };

// GET /api/sites/[siteId] — site detail + the participants collected at it.
export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const site = await db.site.findUnique({ where: { id: siteId } });
  if (!site || site.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sessions = await db.testSession.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      takerEmail: true,
      takerAge: true,
      takerHandedness: true,
      takerEducation: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      project: { select: { id: true, name: true } },
    },
  });

  const projectIds = new Set<string>();
  let completed = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participants = sessions.map((s: any) => {
    if (s.project?.id) projectIds.add(s.project.id);
    const done = !!s.finishedAt;
    if (done) completed += 1;
    return {
      id: s.id,
      email: s.takerEmail,
      age: s.takerAge,
      handedness: s.takerHandedness,
      education: s.takerEducation,
      projectId: s.project?.id ?? null,
      projectName: s.project?.name ?? null,
      completed: done,
      startedAt: s.startedAt,
      createdAt: s.createdAt,
    };
  });

  return NextResponse.json({
    site: {
      id: site.id,
      name: site.name,
      code: site.code,
      location: site.location,
      principalInvestigator: site.principalInvestigator,
    },
    totals: {
      participants: sessions.length,
      completed,
      projectCount: projectIds.size,
    },
    participants,
  });
}

// PATCH /api/sites/[siteId] — edit name/location/PI. Code is immutable so the
// per-site collection links keep working.
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const site = await db.site.findUnique({ where: { id: siteId } });
  if (!site || site.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { name, location, principalInvestigator } = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (typeof name === "string") {
    if (!name.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    data.name = name.trim();
  }
  if (location !== undefined) data.location = location?.trim() || null;
  if (principalInvestigator !== undefined) data.principalInvestigator = principalInvestigator?.trim() || null;

  const updated = await db.site.update({ where: { id: siteId }, data });
  return NextResponse.json({
    site: {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      location: updated.location,
      principalInvestigator: updated.principalInvestigator,
    },
  });
}

// DELETE /api/sites/[siteId] — remove a site. Sessions are kept (siteId → null).
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const site = await db.site.findUnique({ where: { id: siteId } });
  if (!site || site.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.site.delete({ where: { id: siteId } });
  return NextResponse.json({ ok: true });
}
