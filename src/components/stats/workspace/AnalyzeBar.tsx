"use client";
import { DialogKey } from "@/lib/stats";
import {
  BarChart3, Activity, GitCompare, Boxes, Grid3x3, Repeat,
  SplitSquareHorizontal, MoveVertical, Layers, Rows3, ScatterChart, Table2,
  TrendingUp, Spline, Waypoints, Scale, Gauge, LineChart, Network, Binary,
  Ruler, FunctionSquare, Share2, Target, Shuffle, type LucideIcon,
} from "lucide-react";

interface AnalyzeItem { key: DialogKey; label: string; icon: LucideIcon }

const GROUPS: { group: string; items: AnalyzeItem[] }[] = [
  { group: "Descriptive", items: [
    { key: "descriptive", label: "Descriptives", icon: BarChart3 },
    { key: "normality", label: "Normality (S-W, K-S)", icon: Activity },
  ]},
  { group: "Compare means", items: [
    { key: "ttest", label: "T-test", icon: GitCompare },
    { key: "anova", label: "One-way ANOVA", icon: Boxes },
    { key: "anova2", label: "Two-way ANOVA", icon: Grid3x3 },
    { key: "rm-anova", label: "Repeated-measures ANOVA", icon: Repeat },
  ]},
  { group: "Non-parametric", items: [
    { key: "mann-whitney", label: "Mann–Whitney U", icon: SplitSquareHorizontal },
    { key: "wilcoxon", label: "Wilcoxon signed-rank", icon: MoveVertical },
    { key: "kruskal-wallis", label: "Kruskal–Wallis (+ Dunn)", icon: Layers },
    { key: "friedman", label: "Friedman (+ pairwise Wilcoxon)", icon: Rows3 },
  ]},
  { group: "Correlate", items: [
    { key: "correlation", label: "Pearson / Spearman", icon: ScatterChart },
    { key: "chisquare", label: "Chi-square", icon: Table2 },
  ]},
  { group: "Regression", items: [
    { key: "regression", label: "Linear regression", icon: TrendingUp },
    { key: "logistic", label: "Logistic regression", icon: Spline },
    { key: "mediation", label: "Mediation", icon: Waypoints },
  ]},
  { group: "Scale", items: [
    { key: "reliability", label: "Cronbach α", icon: Scale },
    { key: "omega", label: "McDonald's ω", icon: Gauge },
    { key: "roc", label: "ROC / AUC", icon: LineChart },
  ]},
  { group: "Psychometrics", items: [
    { key: "factor", label: "Factor analysis (EFA)", icon: Network },
    { key: "irt", label: "Item response (IRT)", icon: Binary },
  ]},
  { group: "Effect size", items: [
    { key: "effectsize", label: "Cohen d / η² / OR", icon: Ruler },
  ]},
  { group: "Advanced", items: [
    { key: "modelling", label: "Statistical modelling (GLM)", icon: FunctionSquare },
    { key: "sem", label: "Structural equation modelling", icon: Share2 },
  ]},
  { group: "Plan study", items: [
    { key: "power", label: "Sample size & power", icon: Target },
    { key: "randomize", label: "Randomize participants", icon: Shuffle },
  ]},
];

/**
 * Horizontal, always-visible icon bar of every analysis (replaces the old
 * "Analyze" dropdown). Analyses are grouped with a thin divider between groups;
 * each icon shows its full label as a tooltip on hover.
 */
export function AnalyzeBar({
  onPick,
  activeKey,
}: {
  onPick: (key: DialogKey) => void;
  activeKey?: DialogKey | null;
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--surface,#fafafa)] overflow-x-auto">
      <span className="text-[10px] uppercase tracking-wide text-[color:var(--muted)] font-semibold mr-1 shrink-0">
        Analyze
      </span>
      {GROUPS.map((group, gi) => (
        <div key={group.group} className="flex items-center gap-1 shrink-0">
          {gi > 0 && <span className="w-px h-5 bg-[color:var(--border)] mx-1" aria-hidden />}
          {group.items.map((it) => {
            const Icon = it.icon;
            const active = activeKey === it.key;
            return (
              <button
                key={it.key}
                onClick={() => onPick(it.key)}
                aria-label={it.label}
                title={`${group.group} — ${it.label}`}
                className={`group relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors shrink-0
                  ${active ? "bg-indigo-600 text-white" : "text-[color:var(--muted)] hover:bg-indigo-50 hover:text-indigo-700"}`}
              >
                <Icon className="w-4 h-4" />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 z-40 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100"
                >
                  {it.label}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
