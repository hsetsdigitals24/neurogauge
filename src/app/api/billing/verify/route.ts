import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { verifyTransaction, isPaystackConfigured } from "@/lib/billing/paystack";
import { fulfillTransaction } from "@/lib/billing/fulfilment";

export const runtime = "nodejs";

// GET ?reference= — verify a completed checkout and activate the subscription.
// Idempotent and safe to run alongside the webhook; used by the callback page.
export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPaystackConfigured()) {
    return NextResponse.json({ error: "Billing is not yet available" }, { status: 503 });
  }

  const reference = new URL(req.url).searchParams.get("reference");
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  // The transaction must belong to the caller.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txn = await (prisma as any).paymentTransaction.findUnique({ where: { reference } });
  if (!txn || txn.userId !== session.userId) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const verified = await verifyTransaction(reference);
  if (!verified.ok || !verified.data) {
    return NextResponse.json({ error: verified.message || "Verification failed" }, { status: 502 });
  }

  const v = verified.data;
  if (v.status !== "success") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).paymentTransaction.update({
      where: { reference },
      data: { status: v.status || "failed" },
    });
    return NextResponse.json({ status: v.status || "failed" });
  }

  // Idempotent fulfilment — credits the right balance (subscription / project /
  // ai_credits) exactly once, whether verify or the webhook gets here first.
  await fulfillTransaction({
    reference,
    paystackCustomerCode: v.customer?.customer_code ?? null,
    paystackSubscriptionCode: v.subscription_code ?? null,
    currentPeriodEnd: v.paidAt ? new Date(v.paidAt) : null,
    event: "transaction.verify",
  });

  return NextResponse.json({ status: "success", purpose: txn.purpose, planCode: txn.planCode });
}
