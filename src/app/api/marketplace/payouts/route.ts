import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/marketplace/payouts — the caller's consultant earnings summary +
// payout ledger. Payouts are disbursed off-platform for now; this is the record.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.consultantProfile.findUnique({ where: { userId: session.userId }, select: { id: true } });
  if (!profile) return NextResponse.json({ payouts: [], pendingKobo: 0, paidKobo: 0, isConsultant: false });

  const payouts = await db.consultantPayout.findMany({
    where: { consultantId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  type PayoutRow = { status: string; amountKobo: number };
  const pendingKobo = payouts
    .filter((p: PayoutRow) => p.status === "pending")
    .reduce((s: number, p: PayoutRow) => s + p.amountKobo, 0);
  const paidKobo = payouts
    .filter((p: PayoutRow) => p.status === "paid")
    .reduce((s: number, p: PayoutRow) => s + p.amountKobo, 0);

  return NextResponse.json({ payouts, pendingKobo, paidKobo, isConsultant: true });
}
