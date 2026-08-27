import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAiConfigured, generateStructured } from "@/lib/ai/client";
import { resultsSectionSchema } from "@/lib/ai/schemas";
import { spendAiCredit, refundAiCredit } from "@/lib/billing/subscription";

export const maxDuration = 60;

interface TableBlock {
  headers?: string[];
  rows?: (string | number | null)[][];
}

interface Body {
  analysisLabel?: string;
  variables?: Record<string, unknown>;
  options?: Record<string, unknown>;
  result?: {
    stats?: Record<string, unknown>;
    table?: TableBlock;
    warnings?: string[];
    meta?: { n?: number };
  };
}

/** Render a result table as compact pipe-delimited text the model can read. */
function tableToText(table?: TableBlock): string {
  if (!table?.headers?.length || !table.rows?.length) return "";
  const head = table.headers.join(" | ");
  const body = table.rows
    .slice(0, 60)
    .map((r) => r.map((c) => (c == null ? "" : String(c))).join(" | "))
    .join("\n");
  return `${head}\n${body}`;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI results drafting is not configured. Set OPENAI_API_KEY to enable it." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = body.result;
  if (!result || (!result.stats && !result.table)) {
    return NextResponse.json({ error: "No analysis result to write up." }, { status: 400 });
  }

  const analysisLabel = (body.analysisLabel ?? "statistical analysis").trim();
  const tableText = tableToText(result.table);
  const statsText = result.stats ? JSON.stringify(result.stats).slice(0, 6000) : "";
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];

  const system =
    "You are a research statistician drafting the Results section of a peer-reviewed paper. " +
    "Write in past tense, third person, APA 7th-edition style, reporting ONLY the statistics provided — never invent numbers. " +
    "Quote exact test statistics, degrees of freedom, p-values and effect sizes as given, using standard notation (e.g. t(48) = 2.31, p = .024, d = 0.62). " +
    "Drop the leading zero on values bounded by ±1 and report tiny p-values as 'p < .001'. Be concise and cautious: state non-significant results plainly and do not overstate. " +
    "Structure it as one or a few short paragraphs, and suggest a heading. If a table or figure would normally accompany this, include a callout sentence referencing it.";

  const prompt = [
    `Analysis run: ${analysisLabel}.`,
    body.variables ? `Variable mapping: ${JSON.stringify(body.variables)}` : "",
    body.options ? `Options: ${JSON.stringify(body.options)}` : "",
    result.meta?.n != null ? `n = ${result.meta.n}.` : "",
    "",
    tableText ? `Results table:\n${tableText}` : "",
    statsText ? `Raw statistics (JSON):\n${statsText}` : "",
    warnings.length ? `Warnings from the analysis engine:\n${warnings.join("\n")}` : "",
    "",
    "Draft the Results-section prose for this analysis.",
  ].filter(Boolean).join("\n");

  // Metered in AI credits (separate from the subscription). Reserve one up front;
  // refund it if the model call fails so errors don't cost credits.
  const reserved = await spendAiCredit(user.userId);
  if (!reserved) {
    return NextResponse.json(
      { error: "no_ai_credits", message: "You've used all your AI credits, so this results draft can't run yet. Each AI Statistician run uses one credit. Buy an AI credit pack from Billing to continue." },
      { status: 402 },
    );
  }

  let generated;
  try {
    generated = await generateStructured(resultsSectionSchema, { system, prompt });
  } catch (e) {
    await refundAiCredit(user.userId);
    console.error("AI results drafting failed", e);
    return NextResponse.json({ error: "Results drafting failed. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ resultsSection: generated.object, usage: generated.usage });
}
