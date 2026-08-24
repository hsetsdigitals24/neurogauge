import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { listProducts } from "@/lib/billing/products";
import { isPaystackConfigured } from "@/lib/billing/paystack";

// GET — one-off product catalog + the caller's current credit balances.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma as any).user.findUnique({
    where: { id: session.userId },
    select: { aiCredits: true, projectCredits: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    products: listProducts(),
    aiCredits: user.aiCredits ?? 0,
    projectCredits: user.projectCredits ?? 0,
    paystackConfigured: isPaystackConfigured(),
  });
}
