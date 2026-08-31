import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { type AccountType } from "@/lib/billing/plans";
import { verifyWebhookSignature } from "@/lib/billing/paystack";
import { deactivateSubscription } from "@/lib/billing/subscription";
import { fulfillTransaction } from "@/lib/billing/fulfilment";

export const runtime = "nodejs";

// Paystack webhook. Verifies the HMAC signature over the RAW body, then reacts
// to payment/subscription events. Idempotent: activation is an upsert keyed on
// the user, and transactions are keyed on their unique reference.
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const type: string = event?.event ?? "";
  const data = event?.data ?? {};

  try {
    switch (type) {
      case "charge.success": {
        const reference: string | undefined = data.reference;
        if (reference) {
          // Idempotent fulfilment — reads the transaction's purpose/quantity and
          // credits subscription / project / ai_credits exactly once.
          await fulfillTransaction({
            reference,
            paystackCustomerCode: data.customer?.customer_code ?? null,
            paystackSubscriptionCode: data.subscription_code ?? null,
            currentPeriodEnd: data.paid_at ? new Date(data.paid_at) : null,
            event: type,
          });
        }
        break;
      }

      case "subscription.create": {
        // Attach the recurring subscription code so we can manage/cancel later.
        const customerCode: string | undefined = data.customer?.customer_code;
        const planCode: string | undefined = data.plan?.plan_code;
        void planCode;
        if (customerCode) {
          await db.subscription.updateMany({
            where: { paystackCustomerCode: customerCode },
            data: {
              status: "active",
              paystackSubscriptionCode: data.subscription_code ?? undefined,
              paystackEmailToken: data.email_token ?? undefined,
              ...(data.next_payment_date
                ? { currentPeriodEnd: new Date(data.next_payment_date) }
                : {}),
            },
          });
        }
        break;
      }

      case "invoice.update":
      case "invoice.payment_failed": {
        // Paystack fires `invoice.update` for invoices that aren't paid yet
        // (creation, pending, upcoming-renewal notices) as well as for paid
        // ones. Only ever move a subscription to `past_due` on an explicit
        // payment failure — a non-paid `invoice.update` must NOT downgrade an
        // already-active (just-paid) subscription, or the user loses access
        // right after paying.
        const paid = data.paid === true || data.status === "success";
        const failed = type === "invoice.payment_failed";
        const subCode: string | undefined = data.subscription?.subscription_code;
        if (subCode && (paid || failed)) {
          await db.subscription.updateMany({
            where: { paystackSubscriptionCode: subCode },
            data: {
              status: paid ? "active" : "past_due",
              ...(paid && data.subscription?.next_payment_date
                ? { currentPeriodEnd: new Date(data.subscription.next_payment_date) }
                : {}),
            },
          });
        }
        break;
      }

      case "subscription.disable":
      case "subscription.not_renew": {
        const subCode: string | undefined = data.subscription_code;
        if (subCode) {
          const sub = await db.subscription.findFirst({
            where: { paystackSubscriptionCode: subCode },
            select: { userId: true },
          });
          if (sub) {
            const user = await db.user.findUnique({
              where: { id: sub.userId },
              select: { accountType: true },
            });
            await deactivateSubscription(
              sub.userId,
              (user?.accountType as AccountType) || "student"
            );
          }
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged so Paystack stops retrying.
        break;
    }
  } catch (e) {
    console.error("Paystack webhook error:", e);
    // Still 200 so Paystack doesn't hammer retries on a transient failure we've logged.
  }

  return NextResponse.json({ received: true });
}
