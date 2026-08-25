import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type Ctx = { params: Promise<{ id: string }> };

// GET /api/marketplace/consultants/[id] — public detail for an approved
// consultant (plus recent reviews).
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const profile = await db.consultantProfile.findUnique({
    where: { id },
    select: {
      id: true,
      headline: true,
      bio: true,
      expertise: true,
      hourlyRateKobo: true,
      currency: true,
      yearsExperience: true,
      status: true,
      user: { select: { name: true } },
      bookings: {
        where: { review: { isNot: null } },
        select: { review: { select: { rating: true, comment: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!profile || profile.status !== "approved") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reviews = profile.bookings
    .map((b: { review: { rating: number; comment: string | null; createdAt: Date } | null }) => b.review)
    .filter(Boolean);
  const ratings: number[] = reviews.map((r: { rating: number }) => r.rating);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const { bookings: _bookings, user, ...rest } = profile;
  void _bookings;

  return NextResponse.json({
    consultant: { ...rest, name: user?.name ?? "Consultant", avgRating, reviewCount: ratings.length, reviews },
  });
}

// PATCH /api/marketplace/consultants/[id] — the owner edits their own profile.
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await db.consultantProfile.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.headline === "string") data.headline = body.headline.trim();
  if (typeof body.bio === "string") data.bio = body.bio.trim();
  if (Array.isArray(body.expertise)) data.expertise = body.expertise.map((e: unknown) => String(e).trim()).filter(Boolean);
  if (Number.isFinite(Number(body.hourlyRateNaira))) data.hourlyRateKobo = Math.round(Number(body.hourlyRateNaira) * 100);
  if (body.yearsExperience !== undefined) data.yearsExperience = Number(body.yearsExperience) || null;
  for (const f of ["payoutBankCode", "payoutAccountNumber", "payoutAccountName"] as const) {
    if (body[f] !== undefined) data[f] = body[f] ? String(body[f]) : null;
  }

  const profile = await db.consultantProfile.update({ where: { id }, data });
  return NextResponse.json({ profile });
}
