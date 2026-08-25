import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/admin/bookings — all consultation bookings for oversight.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bookings = await db.consultationBooking.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      client: { select: { name: true, email: true } },
      consultant: { select: { headline: true, user: { select: { name: true } } } },
      review: { select: { rating: true } },
    },
  });
  return NextResponse.json({ bookings });
}
