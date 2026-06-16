import type { DialogKey } from "@/lib/stats/workspace";

export type FieldDef =
  | { id: string; label: string; type: "column-numeric"; required: boolean }
  | { id: string; label: string; type: "column-numeric-multi"; required: boolean }
  | { id: string; label: string; type: "column-categorical"; required: boolean }
  | { id: string; label: string; type: "column-any"; required: boolean }
  | { id: string; label: string; type: "column-any-multi"; required: boolean }
  | { id: string; label: string; type: "select"; choices: [string, string][]; default: string }
  | { id: string; label: string; type: "number"; default: number }
  | { id: string; label: string; type: "text"; default: string; placeholder?: string }
  | { id: string; label: string; type: "textarea"; default: string; placeholder?: string; rows?: number }
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
      { id: "columns", label: "Numeric variables", type: "column-numeric-multi", required: false },
      { id: "cat_columns", label: "Categorical variables (counts + pie)", type: "column-any-multi", required: false },
      { id: "group_by", label: "Group by (optional)", type: "column-categorical", required: false },
      { id: "ci_level", label: "CI level", type: "select", choices: [["0.95", "95%"], ["0.99", "99%"], ["0.90", "90%"]], default: "0.95" },
    ],
    toPayload: (v) => ({
      variables: {
        ...(v.columns ? { columns: v.columns } : {}),
        ...(v.cat_columns ? { cat_columns: v.cat_columns } : {}),
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

  "mann-whitney": {
    endpoint: "mann-whitney",
    fields: [
      { id: "column", label: "Variable", type: "column-numeric", required: true },
      { id: "group_by", label: "Group by (2 levels)", type: "column-categorical", required: true },
      { id: "alpha", label: "α (significance)", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"], ["0.10", "0.10"]], default: "0.05" },
      { id: "alternative", label: "Alternative", type: "select", choices: [["two-sided", "Two-sided"], ["less", "Less"], ["greater", "Greater"]], default: "two-sided" },
    ],
    toPayload: (v) => ({
      variables: { column: v.column, group_by: v.group_by },
      options: { alpha: parseFloat(v.alpha as string), alternative: v.alternative },
    }),
  },

  wilcoxon: {
    endpoint: "wilcoxon",
    fields: [
      { id: "column_a", label: "First variable", type: "column-numeric", required: true },
      { id: "column_b", label: "Second variable (paired)", type: "column-numeric", required: true },
      { id: "alpha", label: "α (significance)", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"], ["0.10", "0.10"]], default: "0.05" },
      { id: "alternative", label: "Alternative", type: "select", choices: [["two-sided", "Two-sided"], ["less", "Less"], ["greater", "Greater"]], default: "two-sided" },
    ],
    toPayload: (v) => ({
      variables: { column_a: v.column_a, column_b: v.column_b },
      options: { alpha: parseFloat(v.alpha as string), alternative: v.alternative },
    }),
  },

  "kruskal-wallis": {
    endpoint: "kruskal-wallis",
    fields: [
      { id: "dv", label: "Dependent variable", type: "column-numeric", required: true },
      { id: "between", label: "Group (3 or more levels)", type: "column-categorical", required: true },
      { id: "post_hoc", label: "Post-hoc test", type: "select", choices: [["dunn", "Dunn (Bonferroni)"], ["none", "None"]], default: "dunn" },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"], ["0.10", "0.10"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: { dv: v.dv, between: v.between },
      options: { post_hoc: v.post_hoc, alpha: parseFloat(v.alpha as string) },
    }),
  },

  friedman: {
    endpoint: "friedman",
    fields: [
      { id: "dv", label: "Dependent variable", type: "column-numeric", required: true },
      { id: "within", label: "Within-subject factor (condition/time)", type: "column-categorical", required: true },
      { id: "subject", label: "Subject / participant ID column", type: "column-any", required: true },
      { id: "post_hoc", label: "Post-hoc test", type: "select", choices: [["wilcoxon", "Pairwise Wilcoxon (Bonferroni)"], ["none", "None"]], default: "wilcoxon" },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"], ["0.10", "0.10"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: { dv: v.dv, within: v.within, subject: v.subject },
      options: { post_hoc: v.post_hoc, alpha: parseFloat(v.alpha as string) },
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

  modelling: {
    endpoint: "modelling",
    fields: [
      {
        id: "formula",
        label: "Formula (R-style)",
        type: "text",
        default: "",
        placeholder: "e.g. reaction_time ~ age + group",
      },
      {
        id: "family",
        label: "Distribution family",
        type: "select",
        choices: [
          ["gaussian", "Gaussian (normal, OLS-equivalent)"],
          ["poisson", "Poisson (count data)"],
          ["gamma", "Gamma (positive continuous)"],
          ["binomial", "Binomial (binary / proportion)"],
          ["negativebinomial", "Negative binomial (overdispersed counts)"],
        ],
        default: "gaussian",
      },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"], ["0.10", "0.10"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: { formula: v.formula, family: v.family },
      options: { alpha: parseFloat(v.alpha as string) },
    }),
  },

  sem: {
    endpoint: "sem",
    fields: [
      {
        id: "model",
        label: "Model syntax (semopy / lavaan)",
        type: "textarea",
        default: "",
        placeholder: "# Measurement model\nconstruct =~ item1 + item2 + item3\n\n# Structural model\noutcome ~ construct + covariate",
        rows: 8,
      },
      { id: "alpha", label: "α", type: "select", choices: [["0.05", "0.05"], ["0.01", "0.01"]], default: "0.05" },
    ],
    toPayload: (v) => ({
      variables: { model: v.model },
      options: { alpha: parseFloat(v.alpha as string) },
    }),
  },

  growth: {
    endpoint: "growth",
    fields: [
      { id: "dv", label: "Measure (numeric)", type: "column-numeric", required: true },
      { id: "time", label: "Time / occasion", type: "column-any", required: true },
      { id: "subject", label: "Subject ID (optional)", type: "column-any", required: false },
      { id: "group", label: "Group (optional)", type: "column-categorical", required: false },
      { id: "ci_level", label: "CI level", type: "select", choices: [["0.95", "95%"], ["0.99", "99%"], ["0.90", "90%"]], default: "0.95" },
    ],
    toPayload: (v) => ({
      variables: {
        dv: v.dv,
        time: v.time,
        ...(v.subject ? { subject: v.subject } : {}),
        ...(v.group ? { group: v.group } : {}),
      },
      options: { ci_level: parseFloat(v.ci_level as string) },
    }),
  },

  factor: {
    endpoint: "factor",
    fields: [
      { id: "items", label: "Items (3 or more numeric columns)", type: "column-numeric-multi", required: true },
      { id: "n_factors", label: "Number of factors", type: "text", default: "auto", placeholder: "auto or an integer" },
      { id: "rotation", label: "Rotation", type: "select", choices: [["varimax", "Varimax"], ["none", "None"]], default: "varimax" },
    ],
    toPayload: (v) => {
      const nf = (v.n_factors as string)?.trim();
      return {
        variables: { items: v.items },
        options: {
          rotation: v.rotation,
          n_factors: !nf || nf.toLowerCase() === "auto" ? "auto" : parseInt(nf, 10),
        },
      };
    },
  },

  irt: {
    endpoint: "irt",
    fields: [
      { id: "items", label: "Binary items (2 or more, 0/1 columns)", type: "column-numeric-multi", required: true },
      { id: "model", label: "Model", type: "select", choices: [["2pl", "2PL (difficulty + discrimination)"], ["1pl", "1PL / Rasch"]], default: "2pl" },
    ],
    toPayload: (v) => ({
      variables: { items: v.items },
      options: { model: v.model },
    }),
  },
};
