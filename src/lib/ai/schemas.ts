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

/* ── APA table & figure ─────────────────────────────────────────────────────
 * Reformats a completed analysis's result table into a publication-ready,
 * APA 7th-edition table (title, column heads, cells formatted to APA number
 * conventions, general note) plus a suggested figure. Values must come from the
 * numbers provided — the model reformats, it does not recompute. */

export const apaTableSchema = z.object({
  tableNumber: z.string().describe("APA table label, e.g. 'Table 1'."),
  title: z
    .string()
    .describe("APA table title in title case, italicised in print, e.g. 'Means and Standard Deviations of Reaction Time by Condition'."),
  columns: z
    .array(
      z.object({
        header: z.string().describe("Column heading (APA sentence/stat notation, e.g. 'M', 'SD', 't', 'p')."),
        align: z
          .enum(["left", "center", "right"])
          .nullable()
          .describe("Cell alignment; numeric columns are usually 'right'. Null = left."),
      }),
    )
    .describe("Ordered columns of the APA table."),
  rows: z
    .array(z.array(z.string()))
    .describe(
      "Row cells as display strings, formatted to APA conventions: two decimals for most statistics, no leading zero for values bounded by ±1 (p, r, β), 'p < .001' when tiny, and em dash '—' for empty cells. One inner array per row, matching the column order.",
    ),
  generalNote: z
    .string()
    .nullable()
    .describe("APA general note printed under the table (the text after 'Note.'). Null if none is needed."),
  figure: z
    .object({
      type: z.string().describe("Recommended figure type, e.g. 'Grouped bar chart', 'Boxplot', 'Scatterplot with regression line'."),
      caption: z.string().describe("APA 7th-edition figure caption (the text after 'Figure 1.')."),
      rationale: z.string().describe("Why this figure best communicates the result (1-2 sentences)."),
    })
    .nullable()
    .describe("Suggested figure to accompany the table. Null if a figure would not add value."),
});

export type ApaTable = z.infer<typeof apaTableSchema>;

/* ── Results-section draft ──────────────────────────────────────────────────
 * Drafts the Results-section prose for a completed analysis in APA 7th-edition
 * style, reporting the exact statistics provided. */

export const resultsSectionSchema = z.object({
  heading: z.string().describe("Suggested APA subsection heading in title case, e.g. 'Reaction Time by Condition'."),
  paragraphs: z
    .array(z.string())
    .min(1)
    .describe("Draft Results-section paragraphs in past tense, APA 7th-edition style, quoting the exact statistics, df, p-values and effect sizes provided."),
  tableCallout: z
    .string()
    .nullable()
    .describe("A sentence referencing the accompanying table/figure, e.g. 'Descriptive statistics are presented in Table 1.' Null if not applicable."),
  caveats: z
    .array(z.string())
    .describe("Assumption or interpretation caveats the author should verify before submission. Empty if none."),
});

export type ResultsSection = z.infer<typeof resultsSectionSchema>;
