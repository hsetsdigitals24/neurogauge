import { prisma } from "@/lib/prisma";
import {
  type AccountType,
  type Plan,
  type PlanTier,
  getPlan,
  freePlanFor,
} from "./plans";

// Resolves what a user is actually entitled to right now. Falls back to the
// free plan for the account type unless there's an *active* paid subscription.
// This is the single place feature/limit gating should read from.

export interface Entitlements {
  accountType: AccountType;
  planCode: string;
  planName: string;
  tier: PlanTier;
  status: string; // Subscription status, or "free"
  currentPeriodEnd: string | null;
  features: string[];
  limits: Plan["limits"];
}

export async function getUserSubscription(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  return db.subscription.findUnique({ where: { userId } });
}

export interface ActivationInput {
  userId: string;
  planCode: string;
  paystackCustomerCode?: string | null;
  paystackSubscriptionCode?: string | null;
  paystackEmailToken?: string | null;
  currentPeriodEnd?: Date | null;
}

// Upserts a user's subscription to active on the given plan. Idempotent — safe
// to call from both the checkout-verify path and the webhook for the same
// payment. When no next-payment date is supplied we default to +1 month.
export async function activateSubscription(input: ActivationInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const periodEnd =
    input.currentPeriodEnd ??
    new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

  const data = {
    planCode: input.planCode,
    status: "active" as const,
    currentPeriodEnd: periodEnd,
    ...(input.paystackCustomerCode ? { paystackCustomerCode: input.paystackCustomerCode } : {}),
    ...(input.paystackSubscriptionCode
      ? { paystackSubscriptionCode: input.paystackSubscriptionCode }
      : {}),
    ...(input.paystackEmailToken ? { paystackEmailToken: input.paystackEmailToken } : {}),
  };

  return db.subscription.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, ...data },
    update: data,
  });
}

// Marks a user's subscription back down to the free plan (e.g. Paystack
// subscription disabled / payment failed terminally).
export async function deactivateSubscription(userId: string, accountType: AccountType) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  return db.subscription.updateMany({
    where: { userId },
    data: { status: "canceled", planCode: freePlanFor(accountType).code },
  });
}

interface UserLike {
  accountType?: AccountType | null;
  subscription?: {
    planCode: string;
    status: string;
    currentPeriodEnd: Date | string | null;
  } | null;
}

export function resolveEntitlements(user: UserLike): Entitlements {
  const accountType: AccountType = (user.accountType as AccountType) || "student";
  const sub = user.subscription ?? null;

  const activePaid =
    sub &&
    sub.status === "active" &&
    (() => {
      const plan = getPlan(sub.planCode);
      return plan && plan.tier === "paid";
    })();

  const plan = activePaid ? getPlan(sub!.planCode)! : freePlanFor(accountType);
  const end = sub?.currentPeriodEnd
    ? typeof sub.currentPeriodEnd === "string"
      ? sub.currentPeriodEnd
      : sub.currentPeriodEnd.toISOString()
    : null;

  return {
    accountType,
    planCode: plan.code,
    planName: plan.name,
    tier: plan.tier,
    status: activePaid ? sub!.status : "free",
    currentPeriodEnd: activePaid ? end : null,
    features: plan.features,
    limits: plan.limits,
  };
}

// ── AI-analysis credit metering ───────────────────────────────────────────
// Credits are a standalone currency (separate from the subscription) spent one
// per AI data-analysis call. Reserve/refund are atomic so concurrent calls
// can't overspend and a failed model call doesn't burn a credit.

// Atomically spend one AI credit. Returns true if a credit was available and
// debited, false if the balance was already 0.
export async function spendAiCredit(userId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const res = await db.user.updateMany({
    where: { id: userId, aiCredits: { gt: 0 } },
    data: { aiCredits: { decrement: 1 } },
  });
  return res.count === 1;
}

// Return a previously reserved credit (e.g. the model call failed).
export async function refundAiCredit(userId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  await db.user.update({ where: { id: userId }, data: { aiCredits: { increment: 1 } } });
}

// Convenience gating helpers for future enforcement.
export function hasAi(ent: Entitlements): boolean {
  return ent.limits.aiEnabled;
}

export function withinLimit(
  ent: Entitlements,
  key: keyof Omit<Plan["limits"], "aiEnabled">,
  current: number
): boolean {
  const limit = ent.limits[key];
  return limit === null || current < limit;
}
