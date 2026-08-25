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

// POST /api/training/courses/[id]/enroll — free courses enroll immediately;
// paid courses start a Paystack charge (purpose "course", refId = courseId) and
// enrollment is created on fulfilment. Idempotent on (userId, courseId).
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const course = await db.course.findUnique({ where: { id }, select: { id: true, status: true, priceKobo: true, currency: true } });
  if (!course || course.status !== "published") {
    return NextResponse.json({ error: "Course not available" }, { status: 404 });
  }

  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId: course.id } },
  });
  if (existing) return NextResponse.json({ enrolled: true, alreadyEnrolled: true });

  // Free → enroll directly.
  if ((course.priceKobo ?? 0) <= 0) {
    await db.enrollment.create({ data: { userId: session.userId, courseId: course.id, status: "active" } });
    return NextResponse.json({ enrolled: true });
  }

  // Paid → Paystack checkout.
  if (!isPaystackConfigured()) {
    return NextResponse.json({ error: "Billing is not yet available" }, { status: 503 });
  }
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { email: true } });
  const reference = `ng_course_${crypto.randomBytes(8).toString("hex")}`;

  await db.paymentTransaction.create({
    data: {
      userId: session.userId,
      reference,
      planCode: null,
      purpose: "course",
      refId: course.id,
      quantity: 1,
      amount: course.priceKobo,
      currency: course.currency ?? "NGN",
      status: "pending",
    },
  });

  const callbackUrl = `${baseUrl(req)}/dashboard/billing?reference=${reference}`;
  const init = await initializeTransaction({
    email: user.email,
    amountKobo: course.priceKobo,
    reference,
    callbackUrl,
    metadata: { userId: session.userId, purpose: "course", courseId: course.id },
  });
  if (!init.ok || !init.data) {
    return NextResponse.json({ error: init.message || "Could not start checkout" }, { status: 502 });
  }
  return NextResponse.json({ authorizationUrl: init.data.authorization_url, reference });
}
