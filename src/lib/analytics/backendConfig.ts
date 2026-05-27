import type { DialogKey } from "@/lib/stats/workspace";

export type FieldDef =
  | { id: string; label: string; type: "column-numeric"; required: boolean }
  | { id: string; label: string; type: "column-numeric-multi"; required: boolean }
  | { id: string; label: string; type: "column-categorical"; required: boolean }
  | { id: string; label: string; type: "column-any"; required: boolean }
  | { id: string; label: string; type: "column-any-multi"; required: boolean }
  | { id: string; label: string; type: "select"; choices: [string, string][]; default: string }
  | { id: string; label: string; type: "number"; default: number }
  | { id: string; label: string; type: "text"; default: string }
  | { id: string; label: string; type: "radio"; choices: [string, string][]; default: string };

export interface BackendAnalysisConfig {
  endpoint: string;
  fields: FieldDef[];
  toPayload: (values: Record<string, unknown>) => {
    variables: Record<string, unknown>;
    options: Record<string, unknown>;
  };
}

export const BACKEND_CONFIG: Partial<Record<DialogKey, BackendAnalysisConfig>> = {
  descriptive: {
    endpoint: "descriptive",
    fields: [
      { id: "columns", label: "Variables (one or more)", type: "column-numeric-multi", required: true },
      { id: "group_by", label: "Group by (optional)", type: "column-categorical", required: false },
      { id: "ci_level", label: "CI level", type: "select", choices: [["0.95", "95%"], ["0.99", "99%"], ["0.90", "90%"]], default: "0.95" },
    ],
    toPayload: (v) => ({
      variables: {
        columns: v.columns,
        ...(v.group_by ? { group_by: v.group_by } : {}),
      },
      options: { ci_level: parseFloat(v.ci_level as string) },
    }),
  },

  normality: {
    endpoint: "normality",
    fields: [
      { id: "column", label: "Variable", type: "column-numeric", required: true },
      { id: "group_by", label: "Group by (optional)", type: "column-categorical", required: false },
    ],
    toPayload: (v) => ({
      variables: {
        column: v.column,
        ...(v.group_by ? { group_by: v.group_by } : {}),
      },
      options: { tests: ["shapiro", "ks"] },
    }),
  },

  ttest: {
    endpoint: "ttest",
    fields: [
      { id: "kind", label: "Test type", type: "radio", choices: [["independent", "Independent samples"], ["paired", "Paired samples"], ["one_sample", "One sample"]], default: "independent" },
      { id: "column", label: "Variable", type: "column-numeric", required: true },
      { id: "column_b", label: "Second variable (paired only)", type: "column-numeric", required: false },
      { id: "group_by", label: "Group by (independent only, 2 levels)", type: "column-categorical", required: false },
      { id: "mu", label: "Hypothesised mean μ₀ (one-sample)", type: "number", default: 0 },
      { id: "alpha", label: "α (significance)", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"], ["0.10", "0.10"]], default: "0.05" },
      { id: "alternative", label: "Alternative", type: "select", choices: [["two-sided", "Two-sided"], ["less", "Less"], ["greater", "Greater"]], default: "two-sided" },
    ],
    toPayload: (v) => {
      const kind = v.kind as string;
      const vars: Record<string, unknown> = { kind };
      if (kind === "independent") {
        vars.column = v.column;
        if (v.group_by) vars.group_by = v.group_by;
      } else if (kind === "paired") {
        vars.column_a = v.column;
        vars.column_b = v.column_b;
      } else {
        vars.column = v.column;
        vars.mu = Number(v.mu ?? 0);
      }
      return {
        variables: vars,
        options: { alpha: parseFloat(v.alpha as string), alternative: v.alternative },
      };
    },
  },

  anova: {
    endpoint: "anova",
    fields: [
      { id: "dv", label: "Dependent variable", type: "column-numeric", required: true },
      { id: "between", label: "Between-subject factor", type: "column-categorical", required: true },
      { id: "post_hoc", label: "Post-hoc test", type: "select", choices: [["tukey", "Tukey HSD"], ["bonferroni", "Bonferroni"], ["holm", "Holm"], ["none", "None"]], default: "tukey" },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"], ["0.10", "0.10"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: { dv: v.dv, between: [v.between] },
      options: { post_hoc: v.post_hoc, alpha: parseFloat(v.alpha as string) },
    }),
  },

  anova2: {
    endpoint: "anova",
    fields: [
      { id: "dv", label: "Dependent variable", type: "column-numeric", required: true },
      { id: "factor_a", label: "Factor A (between)", type: "column-categorical", required: true },
      { id: "factor_b", label: "Factor B (between)", type: "column-categorical", required: true },
      { id: "post_hoc", label: "Post-hoc", type: "select", choices: [["tukey", "Tukey HSD"], ["bonferroni", "Bonferroni"], ["none", "None"]], default: "tukey" },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: { dv: v.dv, between: [v.factor_a, v.factor_b] },
      options: { post_hoc: v.post_hoc, alpha: parseFloat(v.alpha as string) },
    }),
  },

  "rm-anova": {
    endpoint: "anova",
    fields: [
      { id: "dv", label: "Dependent variable", type: "column-numeric", required: true },
      { id: "within", label: "Within-subject factor", type: "column-categorical", required: true },
      { id: "subject", label: "Subject / participant ID column", type: "column-any", required: true },
      { id: "between", label: "Between-subject factor (optional)", type: "column-categorical", required: false },
      { id: "post_hoc", label: "Post-hoc", type: "select", choices: [["bonferroni", "Bonferroni"], ["holm", "Holm"], ["none", "None"]], default: "bonferroni" },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: {
        dv: v.dv,
        within: v.within,
        subject: v.subject,
        ...(v.between ? { between: [v.between] } : {}),
      },
      options: { post_hoc: v.post_hoc, alpha: parseFloat(v.alpha as string) },
    }),
  },

  correlation: {
    endpoint: "correlation",
    fields: [
      { id: "columns", label: "Variables (2 or more)", type: "column-numeric-multi", required: true },
      { id: "method", label: "Method", type: "select", choices: [["pearson", "Pearson"], ["spearman", "Spearman"], ["kendall", "Kendall"]], default: "pearson" },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: { columns: v.columns },
      options: { method: v.method, alpha: parseFloat(v.alpha as string) },
    }),
  },

  chisquare: {
    endpoint: "chi-square",
    fields: [
      { id: "row", label: "Row variable (categorical)", type: "column-categorical", required: true },
      { id: "column", label: "Column variable (categorical)", type: "column-categorical", required: true },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: { row: v.row, column: v.column },
      options: { alpha: parseFloat(v.alpha as string) },
    }),
  },

  regression: {
    endpoint: "regression/linear",
    fields: [
      { id: "dv", label: "Dependent variable", type: "column-numeric", required: true },
      { id: "predictors", label: "Predictors (one or more)", type: "column-any-multi", required: true },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: { dv: v.dv, predictors: v.predictors },
      options: { alpha: parseFloat(v.alpha as string), intercept: true },
    }),
  },

  logistic: {
    endpoint: "regression/logistic",
    fields: [
      { id: "dv", label: "Outcome variable (binary)", type: "column-any", required: true },
      { id: "predictors", label: "Predictors (one or more)", type: "column-any-multi", required: true },
      { id: "positive_label", label: "Positive label (value coded as 1)", type: "text", default: "" },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: {
        dv: v.dv,
        predictors: v.predictors,
        ...(v.positive_label ? { positive_label: v.positive_label } : {}),
      },
      options: { alpha: parseFloat(v.alpha as string) },
    }),
  },

  reliability: {
    endpoint: "reliability",
    fields: [
      { id: "items", label: "Items (2 or more numeric columns)", type: "column-numeric-multi", required: true },
    ],
    toPayload: (v) => ({
      variables: { items: v.items },
      options: {},
    }),
  },

  omega: {
    endpoint: "reliability",
    fields: [
      { id: "items", label: "Items (2 or more numeric columns)", type: "column-numeric-multi", required: true },
    ],
    toPayload: (v) => ({
      variables: { items: v.items },
      options: {},
    }),
  },

  roc: {
    endpoint: "roc",
    fields: [
      { id: "truth", label: "Truth / outcome variable (binary)", type: "column-any", required: true },
      { id: "score", label: "Prediction score (numeric)", type: "column-numeric", required: true },
      { id: "positive_label", label: "Positive label", type: "text", default: "" },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: {
        truth: v.truth,
        score: v.score,
        ...(v.positive_label ? { positive_label: v.positive_label } : {}),
      },
      options: { alpha: parseFloat(v.alpha as string), n_bootstrap: 500 },
    }),
  },
};
