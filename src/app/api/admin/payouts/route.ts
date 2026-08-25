import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/admin/payouts — all consultant payout ledger entries.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payouts = await db.consultantPayout.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { consultant: { select: { headline: true, user: { select: { name: true, email: true } } } } },
  });
  return NextResponse.json({ payouts });
}

// PATCH /api/admin/payouts — { id, status } mark a payout paid/pending after
// disbursing off-platform.
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  if (!id || !["pending", "paid"].includes(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const payout = await db.consultantPayout.update({ where: { id }, data: { status } });
  return NextResponse.json({ payout });
}
