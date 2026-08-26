import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAiConfigured, generateStructured } from "@/lib/ai/client";
import { testRecommendationSchema, ANALYSIS_KEYS } from "@/lib/ai/schemas";
import { spendAiCredit, refundAiCredit } from "@/lib/billing/subscription";

// Structured reasoning over the variable list — allow a little headroom.
export const maxDuration = 60;

interface SchemaEntry {
  type?: string;
  label?: string;
}

interface Body {
  schema?: Record<string, SchemaEntry>;
  n?: number;
  question?: string;
  notes?: string;
}

const ALLOWED = new Set<string>(ANALYSIS_KEYS);

// Short capability sheet so the model maps onto tests the workbench can actually
// run. Keep in sync with BACKEND_CONFIG in src/lib/analytics/backendConfig.ts.
const ANALYSIS_MENU = [
  "descriptive — means, SDs, counts, grouped summaries",
  "normality — Shapiro-Wilk / KS test for a numeric variable",
  "ttest — one-sample, paired, or independent-samples t-test (2 groups)",
  "anova — one-way ANOVA (1 categorical factor, 3+ levels)",
  "anova2 — two-way factorial ANOVA (2 categorical factors)",
  "rm-anova — repeated-measures ANOVA (within-subject factor + subject id)",
  "correlation — Pearson/Spearman/Kendall between numeric variables",
  "mann-whitney — non-parametric 2-group comparison",
  "wilcoxon — non-parametric paired comparison",
  "kruskal-wallis — non-parametric 3+ group comparison",
  "friedman — non-parametric repeated measures",
  "chisquare — association between two categorical variables",
  "regression — linear (OLS) regression, numeric outcome",
  "logistic — logistic regression, binary outcome",
  "reliability / omega — internal consistency (Cronbach α / McDonald ω) over item columns",
  "roc — ROC/AUC for a numeric score against a binary truth",
  "modelling — GLM via R-style formula (poisson/gamma/binomial families)",
  "sem — structural equation / path model",
  "growth — latent growth / trajectory over time",
  "factor — exploratory factor analysis over item columns",
  "irt — item response theory (1PL/2PL) over binary items",
].join("\n");

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI recommendations are not configured. Set OPENAI_API_KEY to enable them." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const schema = body.schema && typeof body.schema === "object" ? body.schema : {};
  const columns = Object.entries(schema);
  if (columns.length === 0) {
    return NextResponse.json({ error: "No variables available to analyse." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Describe the research question or comparison you want to test." }, { status: 400 });
  }

  const n = Number.isFinite(body.n) ? Number(body.n) : null;
  const notes = (body.notes ?? "").trim();

  const variableSheet = columns
    .map(([key, s]) => `- ${key} (${s?.type ?? "unknown"})${s?.label && s.label !== key ? ` — ${s.label}` : ""}`)
    .join("\n");

  const system =
    "You are a research statistician advising on which statistical test to run. " +
    "You recommend ONLY tests from the provided menu, and you map each test's inputs to the " +
    "EXACT column names given (never invent columns). Respect variable types: numeric variables " +
    "can be dependent variables or predictors; categorical variables are grouping factors or nominal " +
    "outcomes. Prefer the simplest valid test for the question. When sample size is small or data are " +
    "ordinal/skewed, suggest a non-parametric alternative. Rank recommendations best-first.";

  const prompt = [
    `Research question: ${question}`,
    n != null ? `Sample size (rows): ${n}.` : "",
    "",
    "Available variables (name, type):",
    variableSheet,
    "",
    "Choose tests only from this menu (use the key before the em dash as analysisKey):",
    ANALYSIS_MENU,
    "",
    notes ? `Extra context from the researcher: ${notes}` : "",
    "Return 1-3 recommendations, best first, each mapping its inputs to the exact column names above.",
  ].filter(Boolean).join("\n");

  // AI analysis is metered in credits (separate from the subscription). Reserve
  // one up front; refund it if the model call fails so errors don't cost credits.
  const reserved = await spendAiCredit(user.userId);
  if (!reserved) {
    return NextResponse.json(
      { error: "no_ai_credits", message: "You've used all your AI credits, so this analysis can't run yet. Each AI Statistician run uses one credit. Buy an AI credit pack from Billing to continue." },
      { status: 402 },
    );
  }

  let generated;
  try {
    generated = await generateStructured(testRecommendationSchema, { system, prompt });
  } catch (e) {
    await refundAiCredit(user.userId);
    console.error("AI test recommendation failed", e);
    return NextResponse.json({ error: "Recommendation failed. Please try again." }, { status: 502 });
  }

  // Drop anything that slipped past the enum onto a key the workbench can't run,
  // or that references a column that isn't in the dataset.
  const known = new Set(columns.map(([k]) => k));
  const recommendations = generated.object.recommendations
    .filter((r) => ALLOWED.has(r.analysisKey))
    .map((r) => ({ ...r, variables: r.variables.filter((v) => known.has(v.column)) }));

  return NextResponse.json({ recommendations, usage: generated.usage });
}
