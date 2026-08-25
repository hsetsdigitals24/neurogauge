import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { slugify } from "@/lib/training";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/training/courses — published catalog (admins also see drafts via
// ?includeDrafts=1). Lightweight cards; full content loads per-course.
export async function GET(req: Request) {
  const includeDrafts = new URL(req.url).searchParams.get("includeDrafts") === "1";
  const admin = includeDrafts ? await requireAdmin() : null;

  const where = admin ? {} : { status: "published" };
  const courses = await db.course.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, title: true, summary: true, coverImageUrl: true,
      level: true, priceKobo: true, currency: true, estimatedMinutes: true, status: true,
      _count: { select: { enrollments: true } },
    },
  });

  return NextResponse.json({ courses });
}

// POST /api/training/courses — admin creates a draft course shell.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  // Ensure a unique slug.
  const base = slugify(title);
  let slug = base;
  for (let i = 2; await db.course.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;

  const course = await db.course.create({
    data: {
      slug,
      title,
      summary: String(body.summary ?? "").trim(),
      description: String(body.description ?? "").trim(),
      level: String(body.level ?? "beginner"),
      priceKobo: Number.isFinite(Number(body.priceNaira)) ? Math.round(Number(body.priceNaira) * 100) : 0,
      estimatedMinutes: Number.isFinite(Number(body.estimatedMinutes)) ? Number(body.estimatedMinutes) : null,
      status: "draft",
      authorId: admin.userId,
    },
  });

  return NextResponse.json({ course }, { status: 201 });
}
