import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getPlan, paystackPlanCodeFor, type AccountType } from "@/lib/billing/plans";
import { initializeTransaction, isPaystackConfigured } from "@/lib/billing/paystack";

export const runtime = "nodejs";

function baseUrl(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    new URL(req.url).origin
  );
}

// POST { planCode } — start a Paystack checkout for a paid plan.
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPaystackConfigured()) {
    return NextResponse.json({ error: "Billing is not yet available" }, { status: 503 });
  }

  const { planCode } = await req.json().catch(() => ({}));
  const plan = getPlan(planCode);
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  if (plan.tier !== "paid") {
    return NextResponse.json({ error: "Only paid plans can be purchased" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma as any).user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, accountType: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const accountType: AccountType = (user.accountType as AccountType) || "student";
  if (plan.accountType !== accountType) {
    return NextResponse.json(
      { error: "This plan isn't available for your account type" },
      { status: 403 }
    );
  }

  const paystackPlan = paystackPlanCodeFor(plan.code);
  const reference = `ng_${plan.code}_${crypto.randomBytes(8).toString("hex")}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).paymentTransaction.create({
    data: {
      userId: user.id,
      reference,
      planCode: plan.code,
      amount: plan.priceKobo,
      currency: plan.currency,
      status: "pending",
    },
  });

  const callbackUrl = `${baseUrl(req)}/dashboard/billing?reference=${reference}`;
  const init = await initializeTransaction({
    email: user.email,
    amountKobo: plan.priceKobo,
    reference,
    callbackUrl,
    planCode: paystackPlan,
    metadata: { userId: user.id, planCode: plan.code },
  });

  if (!init.ok || !init.data) {
    return NextResponse.json(
      { error: init.message || "Could not start checkout" },
      { status: 502 }
    );
  }

  return NextResponse.json({ authorizationUrl: init.data.authorization_url, reference });
}
