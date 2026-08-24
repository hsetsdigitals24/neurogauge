import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { resolveEntitlements } from "@/lib/billing/subscription";

// GET — the caller's current subscription + resolved entitlements.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma as any).user.findUnique({
    where: { id: session.userId },
    select: {
      accountType: true,
      subscription: {
        select: { planCode: true, status: true, currentPeriodEnd: true },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ entitlements: resolveEntitlements(user) });
}
