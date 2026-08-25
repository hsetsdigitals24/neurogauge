import { prisma } from "@/lib/prisma";
import { getPlan } from "./plans";
import { activateSubscription } from "./subscription";
import { splitFee } from "./marketplace";

// Single idempotent fulfilment path shared by the checkout-verify route and the
// Paystack webhook. Both fire for the same successful payment, so crediting must
// happen exactly once — the atomic "claim" below flips the transaction to
// success only if it wasn't already, and only the caller that wins the claim
// applies the credit/activation.

export interface FulfillInput {
  reference: string;
  paystackCustomerCode?: string | null;
  paystackSubscriptionCode?: string | null;
  currentPeriodEnd?: Date | null;
  event?: string | null; // paystackEvent tag for the ledger row
}

export interface FulfillResult {
  fulfilled: boolean; // true if THIS call applied the effect (won the claim)
  purpose?: string;
}

export async function fulfillTransaction(input: FulfillInput): Promise<FulfillResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  // Atomic claim: only transitions pending/failed → success once.
  const claim = await db.paymentTransaction.updateMany({
    where: { reference: input.reference, status: { not: "success" } },
    data: { status: "success", paystackEvent: input.event ?? "fulfilment" },
  });
  if (claim.count !== 1) {
    return { fulfilled: false }; // already fulfilled (or unknown reference)
  }

  const txn = await db.paymentTransaction.findUnique({ where: { reference: input.reference } });
  if (!txn) return { fulfilled: false };

  const quantity: number = txn.quantity ?? 1;
  const purpose: string = txn.purpose ?? "subscription";

  switch (purpose) {
    case "project":
      await db.user.update({
        where: { id: txn.userId },
        data: { projectCredits: { increment: quantity } },
      });
      break;

    case "ai_credits":
      await db.user.update({
        where: { id: txn.userId },
        data: { aiCredits: { increment: quantity } },
      });
      break;

    case "consultation": {
      // Paid consulting booking: mark it paid and record the fee split so the
      // consultant's earnings ledger is accurate. refId = booking id.
      if (txn.refId) {
        const split = splitFee(txn.amount);
        await db.consultationBooking.updateMany({
          where: { id: txn.refId, status: { not: "cancelled" } },
          data: {
            status: "paid",
            amountKobo: txn.amount,
            platformFeeKobo: split.platformFeeKobo,
            consultantEarningsKobo: split.consultantEarningsKobo,
            paymentReference: txn.reference,
          },
        });
      }
      break;
    }

    case "course": {
      // Paid course: enroll the buyer. refId = course id. Unique (userId,
      // courseId) makes the enrollment idempotent under the atomic claim.
      if (txn.refId) {
        await db.enrollment.upsert({
          where: { userId_courseId: { userId: txn.userId, courseId: txn.refId } },
          create: {
            userId: txn.userId,
            courseId: txn.refId,
            status: "active",
            paymentReference: txn.reference,
          },
          update: { paymentReference: txn.reference },
        });
      }
      break;
    }

    case "subscription":
    default: {
      const plan = getPlan(txn.planCode);
      if (plan) {
        await activateSubscription({
          userId: txn.userId,
          planCode: plan.code,
          paystackCustomerCode: input.paystackCustomerCode ?? null,
          paystackSubscriptionCode: input.paystackSubscriptionCode ?? null,
          currentPeriodEnd: input.currentPeriodEnd ?? null,
        });
      }
      break;
    }
  }

  return { fulfilled: true, purpose };
}
