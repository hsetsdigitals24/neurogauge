import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Short slug used in per-site collection links (`?site=<code>`); unique per user.
function slugifyCode(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// GET /api/sites — list the caller's collection centres + session counts.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const sites = await db.site.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { sessions: true } } },
  });

  return NextResponse.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sites: sites.map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      location: s.location,
      principalInvestigator: s.principalInvestigator,
      sessionCount: s._count.sessions,
    })),
  });
}

// POST /api/sites — create a collection centre. Code slugified + unique per user.
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, code, location, principalInvestigator } = await req.json();
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Site name is required" }, { status: 400 });
  }

  const slug = slugifyCode(code || name);
  if (!slug) return NextResponse.json({ error: "Invalid site code" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const existing = await db.site.findUnique({
    where: { userId_code: { userId: session.userId, code: slug } },
  });
  if (existing) {
    return NextResponse.json({ error: "A site with that code already exists" }, { status: 409 });
  }

  const site = await db.site.create({
    data: {
      userId: session.userId,
      name: String(name).trim(),
      code: slug,
      location: location?.trim() || null,
      principalInvestigator: principalInvestigator?.trim() || null,
    },
    include: { _count: { select: { sessions: true } } },
  });

  return NextResponse.json(
    {
      site: {
        id: site.id,
        name: site.name,
        code: site.code,
        location: site.location,
        principalInvestigator: site.principalInvestigator,
        sessionCount: site._count.sessions,
      },
    },
    { status: 201 }
  );
}
