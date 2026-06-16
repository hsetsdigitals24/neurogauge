import type { Variable } from "./series";

export type FilterOp = "==" | "!=" | "<" | "<=" | ">" | ">=" | "in";

export type Transform =
  | { op: "mean"; inputIds: string[] }
  | { op: "sum"; inputIds: string[] }
  | { op: "diff"; aId: string; bId: string }
  | { op: "zscore"; inputId: string }
  | { op: "log"; inputId: string; offset?: number }
  | { op: "recode"; inputId: string; bins: { from: number; to: number; label: string }[] }
  | { op: "ifThen"; conditionVarId: string; compareOp: FilterOp; value: number | string;
      thenValue: number | string; elseValue: number | string };

export interface VariableDef {
  id: string;
  label: string;
  role: "numeric" | "ordinal" | "nominal";
  source:
    | { kind: "native"; variable: Variable }
    | { kind: "derived"; transform: Transform };
  missing?: { rule: "none" | "system" | "values"; values?: (string | number)[] };
  valueLabels?: Record<string, string>;
}

export interface FilterClause {
  variableId: string;
  op: FilterOp;
  value: number | string | string[];
}
export interface FilterExpr { clauses: FilterClause[]; }

export type DialogKey =
  | "descriptive" | "normality" | "ttest" | "anova" | "correlation" | "chisquare"
  | "regression" | "logistic" | "reliability" | "effectsize" | "roc"
  | "anova2" | "rm-anova" | "omega" | "growth" | "mediation"
  | "mann-whitney" | "wilcoxon" | "kruskal-wallis" | "friedman"
  | "modelling" | "sem";

export interface OutputEntry {
  id: string;
  timestamp: number;
  title: string;
  test: DialogKey;
  htmlSnapshot: string;            // captured DOM of the dialog body at run time
  csvRows?: (string | number | null | undefined)[][];
  pinned: boolean;
}

export interface WorkspaceState {
  projectId: string;
  variables: VariableDef[];
  filter: FilterExpr;
  activeDialog: DialogKey | null;
  outputs: OutputEntry[];
  centerTab: "data" | "variable" | "dialog";
}

export const SCHEMA_VERSION = 1;

export interface SessionFileV1 {
  version: 1;
  projectId: string;
  variables: VariableDef[];
  filter: FilterExpr;
  outputs: OutputEntry[];
  savedAt: number;
}
