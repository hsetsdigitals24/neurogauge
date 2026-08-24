// Static catalog of one-off (non-recurring) purchases, alongside the recurring
// subscription plans in ./plans.ts. Two kinds:
//   - "project"     — a pay-per-project unlock; grants `quantity` extra project
//                     slots (consumed when creating a project over the free cap).
//   - "ai_credits"  — a top-up of AI data-analysis credits (spent per AI
//                     recommend-test / interpret call, independent of plan tier).
// Unlike plans, these are charged as a single Paystack transaction (no plan code,
// no interval). Prices are placeholders — tune here (NGN kobo).

export type ProductKind = "project" | "ai_credits";

export interface Product {
  code: string;
  kind: ProductKind;
  name: string;
  priceKobo: number; // NGN kobo (₦1 = 100 kobo)
  currency: "NGN";
  quantity: number; // project slots, or AI credits granted
  tagline: string;
}

const naira = (amount: number) => amount * 100;

export const PRODUCTS: Record<string, Product> = {
  // ── Pay per project ──────────────────────────────────────
  project_pass: {
    code: "project_pass",
    kind: "project",
    name: "Project pass",
    priceKobo: naira(1500),
    currency: "NGN",
    quantity: 1,
    tagline: "Unlock one extra project — no subscription needed.",
  },

  // ── AI analysis credits ──────────────────────────────────
  ai_credits_20: {
    code: "ai_credits_20",
    kind: "ai_credits",
    name: "20 AI credits",
    priceKobo: naira(1000),
    currency: "NGN",
    quantity: 20,
    tagline: "20 AI Statistician analyses (recommend a test / interpret results).",
  },
  ai_credits_50: {
    code: "ai_credits_50",
    kind: "ai_credits",
    name: "50 AI credits",
    priceKobo: naira(2000),
    currency: "NGN",
    quantity: 50,
    tagline: "50 AI Statistician analyses — better value per credit.",
  },
  ai_credits_200: {
    code: "ai_credits_200",
    kind: "ai_credits",
    name: "200 AI credits",
    priceKobo: naira(6000),
    currency: "NGN",
    quantity: 200,
    tagline: "200 AI Statistician analyses — best value for heavy use.",
  },
};

export function getProduct(code: string | null | undefined): Product | null {
  if (!code) return null;
  return PRODUCTS[code] ?? null;
}

export function listProducts(): Product[] {
  return Object.values(PRODUCTS);
}
