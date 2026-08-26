import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getPlan } from "@/lib/billing/plans";
import { getProduct } from "@/lib/billing/products";

// A single row in the caller's payment history / receipts ledger.
interface TransactionRow {
  id: string;
  reference: string;
  purpose: string;
  description: string; // human-readable "what this paid for"
  quantity: number;
  amount: number; // kobo
  currency: string;
  status: string; // success | failed | pending
  createdAt: string;
}

// Derive a friendly description from the transaction's purpose + linked plan/product.
function describe(t: {
  purpose: string;
  planCode: string | null;
  quantity: number;
}): string {
  switch (t.purpose) {
    case "subscription": {
      const plan = getPlan(t.planCode);
      return plan ? `${plan.name} subscription` : "Subscription";
    }
    case "project":
      return t.quantity > 1 ? `${t.quantity} project passes` : "Project pass";
    case "ai_credits": {
      const product = getProduct(t.planCode);
      return product ? product.name : `${t.quantity} AI credits`;
    }
    case "consultation":
      return "Consultation booking";
    case "course":
      return "Course enrollment";
    default:
      return "Payment";
  }
}

// GET — the caller's payment history (most recent first). Backs the receipts /
// payments-history page. Only the authenticated user's own transactions.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txns = await (prisma as any).paymentTransaction.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      purpose: true,
      planCode: true,
      quantity: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
    },
  });

  const transactions: TransactionRow[] = txns.map(
    (t: {
      id: string;
      reference: string;
      purpose: string;
      planCode: string | null;
      quantity: number;
      amount: number;
      currency: string;
      status: string;
      createdAt: Date;
    }) => ({
      id: t.id,
      reference: t.reference,
      purpose: t.purpose,
      description: describe(t),
      quantity: t.quantity,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    }),
  );

  return NextResponse.json({ transactions });
}
