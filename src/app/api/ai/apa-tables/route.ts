import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAiConfigured, generateStructured } from "@/lib/ai/client";
import { apaTableSchema } from "@/lib/ai/schemas";
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
      { error: "AI APA tables are not configured. Set OPENAI_API_KEY to enable them." },
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
    return NextResponse.json({ error: "No analysis result to format." }, { status: 400 });
  }

  const analysisLabel = (body.analysisLabel ?? "statistical analysis").trim();
  const tableText = tableToText(result.table);
  const statsText = result.stats ? JSON.stringify(result.stats).slice(0, 6000) : "";
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];

  const system =
    "You are a research statistician preparing tables for a peer-reviewed manuscript. " +
    "Reformat the analysis output the user gives you into a single APA 7th-edition table — do NOT recompute or invent any number. " +
    "Every value must come from the data provided. Follow APA number style: two decimals for most statistics, drop the leading zero on values that cannot exceed 1 in magnitude (p, r, β, partial η²), report tiny p-values as 'p < .001', and use an em dash '—' for empty cells. " +
    "Give the table a concise title in title case. Add a general note only when it aids interpretation (e.g. defining abbreviations, marking significance). " +
    "Then suggest one figure that would best communicate this specific result, with an APA caption. If a figure would not add value, return null for it.";

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
    "Produce the APA table and a suggested figure.",
  ].filter(Boolean).join("\n");

  // Metered in AI credits (separate from the subscription). Reserve one up front;
  // refund it if the model call fails so errors don't cost credits.
  const reserved = await spendAiCredit(user.userId);
  if (!reserved) {
    return NextResponse.json(
      { error: "no_ai_credits", message: "You've used all your AI credits, so this APA table can't be generated yet. Each AI Statistician run uses one credit. Buy an AI credit pack from Billing to continue." },
      { status: 402 },
    );
  }

  let generated;
  try {
    generated = await generateStructured(apaTableSchema, { system, prompt });
  } catch (e) {
    await refundAiCredit(user.userId);
    console.error("AI APA table generation failed", e);
    return NextResponse.json({ error: "APA table generation failed. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ apaTable: generated.object, usage: generated.usage });
}
