import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { resolveEntitlements } from "@/lib/billing/subscription";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ user: null });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma as any).user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      accountType: true,
      aiCredits: true,
      projectCredits: true,
      createdAt: true,
      subscription: {
        select: { planCode: true, status: true, currentPeriodEnd: true },
      },
    },
  });
  if (!user) return NextResponse.json({ user: null });

  const entitlements = resolveEntitlements(user);
  // Don't leak the raw subscription row to the client; expose entitlements.
  const { subscription: _subscription, ...safeUser } = user;
  void _subscription;
  return NextResponse.json({ user: safeUser, entitlements });
}
