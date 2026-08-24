// Static subscription-plan catalog. This file is the source of truth for what
// each account type can buy; the DB `Subscription.planCode` references a `code`
// here. Paystack plan codes live in env (`PAYSTACK_PLAN_<UPPER_CODE>`) and are
// resolved lazily server-side so this module stays import-safe on the client.

export const ACCOUNT_TYPES = ["student", "institution", "research_group"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  student: "Student",
  institution: "Institution",
  research_group: "Research Group",
};

export const ACCOUNT_TYPE_DESCRIPTIONS: Record<AccountType, string> = {
  student: "For an individual student or researcher running your own studies.",
  institution: "For a university, hospital or organisation running multicenter studies across teams and sites.",
  research_group: "For a lab or research group collaborating on shared projects and data.",
};

export type PlanTier = "free" | "paid";

export interface Plan {
  code: string;
  accountType: AccountType;
  name: string;
  tier: PlanTier;
  priceKobo: number; // NGN kobo (₦1 = 100 kobo); 0 for free plans
  currency: "NGN";
  interval: "monthly";
  tagline: string;
  features: string[];
  // Soft entitlement limits (null = unlimited). Enforcement is incremental.
  limits: {
    projects: number | null;
    members: number | null;
    sites: number | null;
    aiEnabled: boolean;
  };
}

const naira = (amount: number) => amount * 100;

// Free + one paid tier per account type. Prices are starting points — tune here.
export const PLANS: Record<string, Plan> = {
  // ── Student ──────────────────────────────────────────────
  student_free: {
    code: "student_free",
    accountType: "student",
    name: "Student Free",
    tier: "free",
    priceKobo: 0,
    currency: "NGN",
    interval: "monthly",
    tagline: "Everything you need to run your own studies.",
    features: ["Up to 3 projects", "Unlimited participants", "CSV export", "Analytics workbench"],
    limits: { projects: 3, members: 1, sites: 0, aiEnabled: false },
  },
  student_pro: {
    code: "student_pro",
    accountType: "student",
    name: "Student Pro",
    tier: "paid",
    priceKobo: naira(2500),
    currency: "NGN",
    interval: "monthly",
    tagline: "Unlimited projects and the AI Statistician.",
    features: ["Unlimited projects", "AI Statistician", "AI questionnaire generation", "Priority support"],
    limits: { projects: null, members: 1, sites: 0, aiEnabled: true },
  },

  // ── Institution ──────────────────────────────────────────
  institution_free: {
    code: "institution_free",
    accountType: "institution",
    name: "Institution Free",
    tier: "free",
    priceKobo: 0,
    currency: "NGN",
    interval: "monthly",
    tagline: "Get your institution started with multicenter studies.",
    features: ["Up to 3 projects", "Up to 2 sites", "Up to 5 team members", "Institution dashboard"],
    limits: { projects: 3, members: 5, sites: 2, aiEnabled: false },
  },
  institution_pro: {
    code: "institution_pro",
    accountType: "institution",
    name: "Institution",
    tier: "paid",
    priceKobo: naira(50000),
    currency: "NGN",
    interval: "monthly",
    tagline: "Unlimited multicenter research at scale.",
    features: ["Unlimited projects", "Unlimited sites & members", "AI Statistician", "Institution dashboard & exports", "Priority support"],
    limits: { projects: null, members: null, sites: null, aiEnabled: true },
  },

  // ── Research group ───────────────────────────────────────
  research_group_free: {
    code: "research_group_free",
    accountType: "research_group",
    name: "Research Group Free",
    tier: "free",
    priceKobo: 0,
    currency: "NGN",
    interval: "monthly",
    tagline: "Collaborate with your lab on shared studies.",
    features: ["Up to 5 projects", "Up to 10 team members", "Shared datasets", "Group dashboard"],
    limits: { projects: 5, members: 10, sites: 1, aiEnabled: false },
  },
  research_group_pro: {
    code: "research_group_pro",
    accountType: "research_group",
    name: "Research Group",
    tier: "paid",
    priceKobo: naira(25000),
    currency: "NGN",
    interval: "monthly",
    tagline: "Unlimited collaboration and AI-assisted analysis.",
    features: ["Unlimited projects & members", "AI Statistician", "AI questionnaire generation", "Group dashboard & exports", "Priority support"],
    limits: { projects: null, members: null, sites: null, aiEnabled: true },
  },
};

export function getPlan(code: string | null | undefined): Plan | null {
  if (!code) return null;
  return PLANS[code] ?? null;
}

export function plansForAccountType(accountType: AccountType): Plan[] {
  return Object.values(PLANS).filter((p) => p.accountType === accountType);
}

export function freePlanFor(accountType: AccountType): Plan {
  const free = plansForAccountType(accountType).find((p) => p.tier === "free");
  // Every account type defines a free plan; fall back defensively.
  return free ?? PLANS.student_free;
}

export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

// Paystack plan code for a paid plan, from env. Returns null when unset so the
// checkout route can decline gracefully.
export function paystackPlanCodeFor(code: string): string | null {
  const key = `PAYSTACK_PLAN_${code.toUpperCase()}`;
  return process.env[key] ?? null;
}
