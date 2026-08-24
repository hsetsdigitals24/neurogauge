/* Shared AI client — ChatGPT (OpenAI) via the AI SDK.
 *
 * Single entry point for every AI feature (questionnaire generation now;
 * interpretation / results drafting later). Uses the OpenAI provider directly,
 * authenticated by OPENAI_API_KEY. `usage` is surfaced on every call so a later
 * billing phase can meter tokens without touching call sites.
 */
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { z } from "zod";

const DEFAULT_MODEL = "gpt-5.1";

/** The model id used for AI calls (override with AI_MODEL). */
export function aiModel(): string {
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Whether AI features are usable. False when the OpenAI key is absent, so
 * routes can return a clean 503 instead of throwing deep in the SDK.
 */
export function isAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}

export interface StructuredResult<T> {
  object: T;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

/**
 * Generate a schema-validated object. Throws if AI is not configured — callers
 * should gate with `isAiConfigured()` first to return a friendly error.
 */
export async function generateStructured<T>(
  schema: z.ZodType<T>,
  { system, prompt, maxRetries = 2 }: { system?: string; prompt: string; maxRetries?: number },
): Promise<StructuredResult<T>> {
  if (!isAiConfigured()) {
    throw new Error("AI is not configured (OPENAI_API_KEY missing)");
  }

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const { object, usage } = await generateObject({
    model: openai(aiModel()),
    schema,
    system,
    prompt,
    maxRetries,
  });

  return {
    object,
    usage: {
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      totalTokens: usage?.totalTokens,
    },
  };
}
