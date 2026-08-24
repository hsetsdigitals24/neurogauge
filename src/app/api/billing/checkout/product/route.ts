import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getProduct } from "@/lib/billing/products";
import { initializeTransaction, isPaystackConfigured } from "@/lib/billing/paystack";

export const runtime = "nodejs";

function baseUrl(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    new URL(req.url).origin
  );
}

// POST { productCode } — start a one-off Paystack charge for a product
// (project pass or AI credit pack). Unlike plan checkout this attaches no plan
// code, so Paystack charges once rather than creating a subscription.
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPaystackConfigured()) {
    return NextResponse.json({ error: "Billing is not yet available" }, { status: 503 });
  }

  const { productCode } = await req.json().catch(() => ({}));
  const product = getProduct(productCode);
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma as any).user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reference = `ng_${product.code}_${crypto.randomBytes(8).toString("hex")}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).paymentTransaction.create({
    data: {
      userId: user.id,
      reference,
      planCode: null,
      purpose: product.kind, // "project" | "ai_credits"
      quantity: product.quantity,
      amount: product.priceKobo,
      currency: product.currency,
      status: "pending",
    },
  });

  const callbackUrl = `${baseUrl(req)}/dashboard/billing?reference=${reference}`;
  const init = await initializeTransaction({
    email: user.email,
    amountKobo: product.priceKobo,
    reference,
    callbackUrl,
    metadata: { userId: user.id, purpose: product.kind, productCode: product.code, quantity: product.quantity },
  });

  if (!init.ok || !init.data) {
    return NextResponse.json(
      { error: init.message || "Could not start checkout" },
      { status: 502 }
    );
  }

  return NextResponse.json({ authorizationUrl: init.data.authorization_url, reference });
}
