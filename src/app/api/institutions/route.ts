import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { slugifyInstitutionCode } from "@/lib/institution";

// GET /api/institutions — the institutions the caller is a member of, with role
// + lightweight counts (members, linked projects).
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const memberships = await db.institutionMember.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    include: {
      institution: {
        include: { _count: { select: { members: true, projectLinks: true } } },
      },
    },
  });

  return NextResponse.json({
    institutions: memberships.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => ({
        id: m.institution.id,
        name: m.institution.name,
        code: m.institution.code,
        role: m.role,
        memberCount: m.institution._count.members,
        projectCount: m.institution._count.projectLinks,
        createdAt: m.institution.createdAt,
      })
    ),
  });
}

// POST /api/institutions — create an institution. The creator becomes its owner
// member. Code is slugified and globally unique.
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, code } = await req.json();
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Institution name is required" }, { status: 400 });
  }

  const slug = slugifyInstitutionCode(code || name);
  if (!slug) return NextResponse.json({ error: "Invalid institution code" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const existing = await db.institution.findUnique({ where: { code: slug } });
  if (existing) {
    return NextResponse.json(
      { error: "An institution with that code already exists. Try a different code." },
      { status: 409 }
    );
  }

  const institution = await db.institution.create({
    data: {
      name: String(name).trim(),
      code: slug,
      members: { create: { userId: session.userId, role: "owner" } },
    },
    include: { _count: { select: { members: true, projectLinks: true } } },
  });

  return NextResponse.json(
    {
      institution: {
        id: institution.id,
        name: institution.name,
        code: institution.code,
        role: "owner",
        memberCount: institution._count.members,
        projectCount: institution._count.projectLinks,
        createdAt: institution.createdAt,
      },
    },
    { status: 201 }
  );
}
