import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAiConfigured, generateStructured } from "@/lib/ai/client";
import { resultInterpretationSchema } from "@/lib/ai/schemas";
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
    .slice(0, 40)
    .map((r) => r.map((c) => (c == null ? "" : String(c))).join(" | "))
    .join("\n");
  return `${head}\n${body}`;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI interpretation is not configured. Set OPENAI_API_KEY to enable it." },
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
    return NextResponse.json({ error: "No analysis result to interpret." }, { status: 400 });
  }

  const analysisLabel = (body.analysisLabel ?? "statistical analysis").trim();
  const tableText = tableToText(result.table);
  // Cap the stats blob so an unusually large result can't blow the token budget.
  const statsText = result.stats ? JSON.stringify(result.stats).slice(0, 6000) : "";
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];

  const system =
    "You are a research statistician writing up results for a peer-reviewed paper. " +
    "Interpret ONLY the numbers provided — never invent statistics or p-values. " +
    "Quote exact test statistics, degrees of freedom, p-values and effect sizes as given. " +
    "Write the APA sentence in APA 7th-edition style (italicise statistic symbols in prose is not needed; " +
    "just use standard notation like t(48) = 2.31, p = .024, d = 0.62). Be precise and cautious: if the " +
    "result is non-significant, say so plainly and do not overstate.";

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
    "Interpret this result for the researcher.",
  ].filter(Boolean).join("\n");

  // AI analysis is metered in credits (separate from the subscription). Reserve
  // one up front; refund it if the model call fails so errors don't cost credits.
  const reserved = await spendAiCredit(user.userId);
  if (!reserved) {
    return NextResponse.json(
      { error: "no_ai_credits", message: "You've used all your AI credits, so this interpretation can't run yet. Each AI Statistician run uses one credit. Buy an AI credit pack from Billing to continue." },
      { status: 402 },
    );
  }

  let generated;
  try {
    generated = await generateStructured(resultInterpretationSchema, { system, prompt });
  } catch (e) {
    await refundAiCredit(user.userId);
    console.error("AI result interpretation failed", e);
    return NextResponse.json({ error: "Interpretation failed. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ interpretation: generated.object, usage: generated.usage });
}
