import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/marketplace/consultants — public directory of approved consultants.
// Optional ?expertise= filter (matches any tag). Includes an aggregate rating.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const expertise = url.searchParams.get("expertise")?.trim();

  const where: Record<string, unknown> = { status: "approved" };
  if (expertise) where.expertise = { has: expertise };

  const profiles = await db.consultantProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      headline: true,
      bio: true,
      expertise: true,
      hourlyRateKobo: true,
      currency: true,
      yearsExperience: true,
      user: { select: { name: true } },
      bookings: {
        where: { review: { isNot: null } },
        select: { review: { select: { rating: true } } },
      },
    },
  });

  const consultants = profiles.map((p: { bookings: { review: { rating: number } | null }[]; user: { name: string } | null; [k: string]: unknown }) => {
    const ratings: number[] = p.bookings
      .map((b) => b.review?.rating)
      .filter((r: unknown): r is number => typeof r === "number");
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    const { bookings: _bookings, ...rest } = p;
    void _bookings;
    return { ...rest, name: p.user?.name ?? "Consultant", avgRating, reviewCount: ratings.length };
  });

  return NextResponse.json({ consultants });
}

// POST /api/marketplace/consultants — apply to become a consultant (creates a
// pending profile) or upsert your own profile. One profile per user.
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const headline = String(body.headline ?? "").trim();
  const bio = String(body.bio ?? "").trim();
  const hourlyRateNaira = Number(body.hourlyRateNaira);
  const expertise: string[] = Array.isArray(body.expertise)
    ? body.expertise.map((e: unknown) => String(e).trim()).filter(Boolean)
    : String(body.expertise ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

  if (!headline || !bio) {
    return NextResponse.json({ error: "Headline and bio are required." }, { status: 400 });
  }
  if (!Number.isFinite(hourlyRateNaira) || hourlyRateNaira <= 0) {
    return NextResponse.json({ error: "A valid hourly rate is required." }, { status: 400 });
  }

  const data = {
    headline,
    bio,
    expertise,
    hourlyRateKobo: Math.round(hourlyRateNaira * 100),
    yearsExperience: Number.isFinite(Number(body.yearsExperience)) ? Number(body.yearsExperience) : null,
    payoutBankCode: body.payoutBankCode ? String(body.payoutBankCode) : null,
    payoutAccountNumber: body.payoutAccountNumber ? String(body.payoutAccountNumber) : null,
    payoutAccountName: body.payoutAccountName ? String(body.payoutAccountName) : null,
  };

  // Re-applying resets to pending for re-review of the edited profile.
  const profile = await db.consultantProfile.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, status: "pending", ...data },
    update: { status: "pending", ...data },
  });

  return NextResponse.json({ profile }, { status: 201 });
}
