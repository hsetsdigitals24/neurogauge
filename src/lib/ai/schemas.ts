/* Zod schemas for structured AI outputs. Used with generateObject so model
 * output is validated before it ever reaches the app. */
import { z } from "zod";

/** A single generated question. Kept close to the app's QItem but without the
 * app-assigned id/key (those are added server-side after generation). */
export const generatedQuestionSchema = z.object({
  prompt: z.string().describe("The question text shown to the participant."),
  type: z
    .enum(["open", "single", "multi", "likert", "numeric"])
    .describe(
      "open = free text; single = one choice; multi = multiple choices; likert = agreement scale; numeric = a number.",
    ),
  // OpenAI strict structured-output mode requires every property to appear in
  // `required`, so these use `.nullable()` (always present, may be null) rather
  // than `.optional()` (absent), which the Responses API rejects.
  options: z
    .array(z.string())
    .nullable()
    .describe("Answer choices for single/multi questions. Use null for other types."),
  scalePoints: z
    .number()
    .int()
    .min(3)
    .max(7)
    .nullable()
    .describe("Number of points for a likert scale (e.g. 5). Use null for non-likert."),
  required: z.boolean().nullable().describe("Whether an answer is mandatory."),
});

export const questionnaireSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GeneratedQuestionnaire = z.infer<typeof questionnaireSchema>;

/* ── Statistical-test recommendation ─────────────────────────────────────────
 * The AI maps a research question + the dataset's variables onto one of the
 * workbench's backend analyses. `analysisKey` is validated against the actual
 * analysis registry server-side, so here it is a plain string. */

/** Backend analyses the recommender is allowed to point at. Mirrors the keys of
 *  BACKEND_CONFIG in src/lib/analytics/backendConfig.ts — keep in sync. */
export const ANALYSIS_KEYS = [
  "descriptive", "normality", "ttest", "anova", "anova2", "rm-anova",
  "correlation", "mann-whitney", "wilcoxon", "kruskal-wallis", "friedman",
  "chisquare", "regression", "logistic", "reliability", "omega", "roc",
  "modelling", "sem", "growth", "factor", "irt",
] as const;

export const testRecommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        testName: z.string().describe("Human-readable test name, e.g. 'Independent-samples t-test'."),
        analysisKey: z
          .enum(ANALYSIS_KEYS)
          .describe("Which workbench analysis implements this test."),
        variables: z
          .array(
            z.object({
              role: z.string().describe("The variable's role, e.g. 'Dependent variable', 'Grouping factor'."),
              column: z.string().describe("The exact dataset column name (key) filling that role."),
            }),
          )
          .describe("How the dataset's columns map onto this test's inputs."),
        rationale: z.string().describe("Why this test fits the question and the variable types (2-4 sentences)."),
        assumptions: z
          .array(z.string())
          .describe("Key assumptions to check before trusting the result, e.g. normality, equal variances."),
        alternatives: z
          .string()
          .nullable()
          .describe("Non-parametric or other fallbacks if assumptions fail. Null if none apply."),
        confidence: z
          .enum(["high", "medium", "low"])
          .describe("How well the data supports this recommendation."),
      }),
    )
    .min(1)
    .describe("Ranked best-first. Usually 1-3 recommendations."),
});

export type TestRecommendation = z.infer<typeof testRecommendationSchema>["recommendations"][number];
export type TestRecommendations = z.infer<typeof testRecommendationSchema>;

/* ── Result interpretation ──────────────────────────────────────────────────
 * Turns a completed analysis (stats + table returned by the Python service)
 * into a plain-language reading plus an APA-style results sentence. */

export const resultInterpretationSchema = z.object({
  summary: z.string().describe("Plain-language reading of what the result means (2-4 sentences, no jargon)."),
  apa: z.string().describe("APA 7th-edition style results sentence(s), with exact statistics and p-values from the data."),
  significant: z
    .boolean()
    .nullable()
    .describe("Whether the primary test was statistically significant at the stated alpha. Null if not applicable."),
  effectSize: z
    .string()
    .nullable()
    .describe("Effect-size magnitude and interpretation (e.g. 'd = 0.62, medium'). Null if none reported."),
  caveats: z
    .array(z.string())
    .describe("Assumption violations, small-sample or multiple-comparison caveats worth flagging. Empty if none."),
});

export type ResultInterpretation = z.infer<typeof resultInterpretationSchema>;
