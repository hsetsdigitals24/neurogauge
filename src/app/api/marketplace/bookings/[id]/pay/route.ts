import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { initializeTransaction, isPaystackConfigured } from "@/lib/billing/paystack";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type Ctx = { params: Promise<{ id: string }> };

function baseUrl(req: Request): string {
  return process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || new URL(req.url).origin;
}

// POST /api/marketplace/bookings/[id]/pay — the client pays for a confirmed
// booking. Creates a PaymentTransaction (purpose: "consultation", refId =
// booking id) and starts a one-off Paystack charge; fulfilment marks the
// booking paid + records the fee split. Callback reuses /dashboard/billing.
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPaystackConfigured()) {
    return NextResponse.json({ error: "Billing is not yet available" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const booking = await db.consultationBooking.findUnique({ where: { id } });
  if (!booking || booking.clientId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!["requested", "confirmed"].includes(booking.status)) {
    return NextResponse.json({ error: "This booking can't be paid for." }, { status: 400 });
  }
  const amountKobo = booking.amountKobo ?? 0;
  if (amountKobo <= 0) return NextResponse.json({ error: "Invalid booking amount." }, { status: 400 });

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { email: true } });
  const reference = `ng_consult_${crypto.randomBytes(8).toString("hex")}`;

  await db.paymentTransaction.create({
    data: {
      userId: session.userId,
      reference,
      planCode: null,
      purpose: "consultation",
      refId: booking.id,
      quantity: 1,
      amount: amountKobo,
      currency: booking.currency ?? "NGN",
      status: "pending",
    },
  });

  const callbackUrl = `${baseUrl(req)}/dashboard/billing?reference=${reference}`;
  const init = await initializeTransaction({
    email: user.email,
    amountKobo,
    reference,
    callbackUrl,
    metadata: { userId: session.userId, purpose: "consultation", bookingId: booking.id },
  });

  if (!init.ok || !init.data) {
    return NextResponse.json({ error: init.message || "Could not start checkout" }, { status: 502 });
  }
  return NextResponse.json({ authorizationUrl: init.data.authorization_url, reference });
}
