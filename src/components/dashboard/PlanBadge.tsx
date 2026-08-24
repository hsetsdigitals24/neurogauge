"use client";
import Link from "next/link";
import { Sparkles, Crown } from "lucide-react";

export interface Entitlements {
  accountType: string;
  planCode: string;
  planName: string;
  tier: "free" | "paid";
  status: string;
}

// Compact plan chip shown on the dashboard: current plan + an upgrade CTA when
// the account is on a free plan.
export function PlanBadge({ entitlements }: { entitlements: Entitlements | null }) {
  if (!entitlements) return null;
  const isPaid = entitlements.tier === "paid";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
          isPaid
            ? "bg-amber-50 text-amber-700 border border-amber-200"
            : "bg-gray-100 text-[color:var(--muted)]"
        }`}
      >
        {isPaid ? <Crown className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
        {entitlements.planName}
      </span>
      {!isPaid && (
        <Link
          href="/dashboard/billing"
          className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
        >
          Upgrade <Sparkles className="w-3.5 h-3.5" />
        </Link>
      )}
      {isPaid && (
        <Link href="/dashboard/billing" className="text-xs text-[color:var(--muted)] hover:underline">
          Manage plan
        </Link>
      )}
    </div>
  );
}
