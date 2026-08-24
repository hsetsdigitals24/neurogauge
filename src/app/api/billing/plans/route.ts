import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { plansForAccountType, type AccountType } from "@/lib/billing/plans";
import { resolveEntitlements } from "@/lib/billing/subscription";
import { isPaystackConfigured } from "@/lib/billing/paystack";

// GET — the plan catalog for the caller's account type + which plan they're on.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma as any).user.findUnique({
    where: { id: session.userId },
    select: {
      accountType: true,
      subscription: { select: { planCode: true, status: true, currentPeriodEnd: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const accountType: AccountType = (user.accountType as AccountType) || "student";
  const entitlements = resolveEntitlements(user);

  return NextResponse.json({
    accountType,
    plans: plansForAccountType(accountType),
    currentPlanCode: entitlements.planCode,
    paystackConfigured: isPaystackConfigured(),
  });
}
