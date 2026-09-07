import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { slugifyInstitutionCode } from "@/lib/institution";

type Ctx = { params: Promise<{ id: string }> };

type OwnGuard = { ok: false; error: string; status: number } | { ok: true };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireOwnedProject(db: any, projectId: string, userId: string): Promise<OwnGuard> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project) return { ok: false, error: "Not found", status: 404 };
  if (project.ownerId !== userId) {
    return { ok: false, error: "Only the project owner can manage institutions", status: 403 };
  }
  return { ok: true };
}

// GET /api/projects/[id]/institutions — the institutions linked to this project
// (owner only), each with its assigned collection site.
export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const guard = await requireOwnedProject(db, id, session.userId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const links = await db.projectInstitution.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    include: {
      institution: {
        select: { id: true, name: true, code: true, _count: { select: { members: true } } },
      },
      site: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json({
    institutions: links.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (l: any) => ({
        linkId: l.id,
        institutionId: l.institution.id,
        name: l.institution.name,
        code: l.institution.code,
        memberCount: l.institution._count.members,
        site: l.site ? { id: l.site.id, name: l.site.name, code: l.site.code } : null,
      })
    ),
  });
}

// POST /api/projects/[id]/institutions — link an institution (by code) to this
// project and assign it a collection site (owned by the caller). Owner only.
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { code, siteId } = await req.json();
  if (!code || !String(code).trim()) {
    return NextResponse.json({ error: "Institution code is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const guard = await requireOwnedProject(db, id, session.userId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const slug = slugifyInstitutionCode(code);
  const institution = await db.institution.findUnique({ where: { code: slug } });
  if (!institution) {
    return NextResponse.json({ error: "No institution found with that code" }, { status: 404 });
  }

  // The assigned site must belong to the project owner (sites are lead-owned).
  let resolvedSiteId: string | null = null;
  if (siteId) {
    const site = await db.site.findUnique({ where: { id: siteId }, select: { userId: true } });
    if (!site || site.userId !== session.userId) {
      return NextResponse.json({ error: "Invalid site" }, { status: 400 });
    }
    resolvedSiteId = siteId;
  }

  const existing = await db.projectInstitution.findUnique({
    where: { projectId_institutionId: { projectId: id, institutionId: institution.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "That institution is already linked to this project" }, { status: 409 });
  }

  const link = await db.projectInstitution.create({
    data: { projectId: id, institutionId: institution.id, siteId: resolvedSiteId },
    include: {
      institution: { select: { id: true, name: true, code: true, _count: { select: { members: true } } } },
      site: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json(
    {
      link: {
        linkId: link.id,
        institutionId: link.institution.id,
        name: link.institution.name,
        code: link.institution.code,
        memberCount: link.institution._count.members,
        site: link.site ? { id: link.site.id, name: link.site.name, code: link.site.code } : null,
      },
    },
    { status: 201 }
  );
}

// DELETE /api/projects/[id]/institutions?linkId=... — unlink an institution.
export async function DELETE(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const linkId = new URL(req.url).searchParams.get("linkId");
  if (!linkId) return NextResponse.json({ error: "linkId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const guard = await requireOwnedProject(db, id, session.userId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const link = await db.projectInstitution.findUnique({ where: { id: linkId } });
  if (!link || link.projectId !== id) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  await db.projectInstitution.delete({ where: { id: linkId } });
  return NextResponse.json({ ok: true });
}
