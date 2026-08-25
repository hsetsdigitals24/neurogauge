import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type Ctx = { params: Promise<{ id: string }> };

// POST — the client leaves a review for a completed booking (one per booking).
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const booking = await db.consultationBooking.findUnique({ where: { id } });
  if (!booking || booking.clientId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.status !== "completed") {
    return NextResponse.json({ error: "You can review a booking once it's completed." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const rating = Math.round(Number(body.rating));
  const comment = body.comment ? String(body.comment).trim() : null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1–5." }, { status: 400 });
  }

  const review = await db.consultationReview.upsert({
    where: { bookingId: id },
    create: { bookingId: id, rating, comment },
    update: { rating, comment },
  });
  return NextResponse.json({ review }, { status: 201 });
}
