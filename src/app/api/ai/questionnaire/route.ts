import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAiConfigured, generateStructured } from "@/lib/ai/client";
import { questionnaireSchema } from "@/lib/ai/schemas";
import { sanitiseColumnKey, uniqueKey } from "@/lib/analytics/csvIngest";
import { generateId } from "@/lib/id";
import type { QItem, QuestionType } from "@/lib/types";

// Longer than the default — structured generation of a full questionnaire.
export const maxDuration = 60;

interface Body {
  construct?: string;
  audience?: string;
  count?: number;
  types?: string[];
  scalePoints?: number;
  tone?: string;
  notes?: string;
}

const ALLOWED_TYPES = new Set<QuestionType>(["open", "single", "multi", "likert", "numeric"]);

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI generation is not configured. Add questions manually, or set OPENAI_API_KEY to enable it." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const construct = (body.construct ?? "").trim();
  if (!construct) {
    return NextResponse.json({ error: "Describe what you want to measure." }, { status: 400 });
  }

  const count = Math.min(Math.max(Number(body.count) || 10, 1), 50);
  const audience = (body.audience ?? "").trim() || "general adult respondents";
  const tone = (body.tone ?? "neutral").trim();
  const scalePoints = Math.min(Math.max(Number(body.scalePoints) || 5, 3), 7);
  const notes = (body.notes ?? "").trim();
  const requestedTypes = (Array.isArray(body.types) ? body.types : [])
    .filter((t): t is QuestionType => ALLOWED_TYPES.has(t as QuestionType));
  const typeList = requestedTypes.length ? requestedTypes : (["likert"] as QuestionType[]);

  // Map the setup form's UI vocabulary to the schema's question types.
  const typeGuidance = typeList
    .map((t) => (t === "single" || t === "multi" ? `${t} (multiple choice)` : t))
    .join(", ");

  const system =
    "You are a psychometrician who designs rigorous questionnaires for statistical research studies. " +
    "You write clear, single-barrelled, unbiased items suitable for later statistical analysis. " +
    "Prefer closed items (likert/single/multi/numeric) when the researcher wants quantitative analysis, " +
    "and use open-ended items sparingly. For likert items, set scalePoints and keep the construct's polarity consistent.";

  const prompt = [
    `Design a questionnaire of ${count} items measuring: ${construct}.`,
    `Target audience: ${audience}.`,
    `Tone: ${tone}.`,
    `Use only these question types: ${typeGuidance}.`,
    typeList.includes("likert") ? `Default likert scale points: ${scalePoints}.` : "",
    `For single/multi items, provide concrete, mutually appropriate answer options.`,
    notes ? `Additional guidance from the researcher: ${notes}` : "",
    `Return well-formed items ready to administer.`,
  ].filter(Boolean).join("\n");

  let generated;
  try {
    generated = await generateStructured(questionnaireSchema, { system, prompt });
  } catch (e) {
    console.error("AI questionnaire generation failed", e);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 502 });
  }

  // Assign app ids + analysis-safe unique column keys.
  const usedKeys = new Set<string>();
  const questions: QItem[] = generated.object.questions.map((q, i) => {
    const type = ALLOWED_TYPES.has(q.type as QuestionType) ? (q.type as QuestionType) : "open";
    const base = sanitiseColumnKey(q.prompt, `q_${i + 1}`).slice(0, 40) || `q_${i + 1}`;
    const key = uniqueKey(base, usedKeys);
    usedKeys.add(key);
    const item: QItem = { id: generateId(), key, prompt: q.prompt.trim(), type };
    if (type === "single" || type === "multi") item.options = (q.options ?? []).filter(Boolean);
    if (type === "likert") item.scalePoints = q.scalePoints ?? scalePoints;
    if (q.required) item.required = true;
    return item;
  });

  return NextResponse.json({ questions, usage: generated.usage });
}
