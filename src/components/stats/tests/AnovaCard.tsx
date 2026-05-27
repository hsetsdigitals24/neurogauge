"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, groupByCategory,
  oneWayAnova, tukeyHSD, bonferroniPairwise, fmt, fmtP, pStars, variableLabel,
  type AnovaResult, type PostHocPair,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker, CategoricalPicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { BoxPlot } from "../BoxPlot";
import { BarChart } from "../BarChart";
import { ChartDownload } from "../ChartDownload";
import { useExtract } from "../workspace/WorkspaceProvider";

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function AnovaCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [dv, setDv] = useState<Variable | null>(null);
  const [iv, setIv] = useState<Variable | null>(null);
  const [posthoc, setPosthoc] = useState<"tukey" | "bonferroni">("tukey");
  const [alpha, setAlpha] = useState(0.05);

  type Res = { error: string } | { anova: AnovaResult; pairs: PostHocPair[]; groups: { name: string; values: number[] }[] };
  const result = useMemo<Res | null>(() => {
    if (!dv || !iv) return null;
    const vals = extractNumeric(sessions, dv, questions);
    const cats = extractCategorical(sessions, iv, questions);
    const groups = groupByCategory(vals, cats);
    if (groups.length < 2) return { error: `Need ≥2 groups; found ${groups.length}.` };
    const anova = oneWayAnova(groups);
    const pairs = posthoc === "tukey" ? tukeyHSD(groups, alpha) : bonferroniPairwise(groups, alpha);
    return { anova, pairs, groups };
  }, [dv, iv, posthoc, alpha, sessions, questions]);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <VariablePicker catalog={catalog} value={dv} onChange={setDv} label="Dependent variable (numeric)" />
        <CategoricalPicker catalog={catalog} value={iv} onChange={setIv} label="Independent variable (grouping)" />
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="label text-xs">Post-hoc</span>
          <select className="select" value={posthoc} onChange={(e) => setPosthoc(e.target.value as "tukey" | "bonferroni")}>
            <option value="tukey">Tukey HSD</option>
            <option value="bonferroni">Bonferroni</option>
          </select>
        </label>
        <label className="block">
          <span className="label text-xs">α</span>
          <select className="select" value={String(alpha)} onChange={(e) => setAlpha(parseFloat(e.target.value))}>
            <option value="0.1">0.10</option>
            <option value="0.05">0.05</option>
            <option value="0.01">0.01</option>
          </select>
        </label>
      </div>

      {result && "error" in result && <p className="text-sm text-[color:var(--danger)]">{result.error}</p>}
      {result && "anova" in result && (
        <>
          <p className="text-sm font-semibold">
            {dv && variableLabel(dv, questions)} by {iv && variableLabel(iv, questions)}
          </p>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Groups</h5>
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr><th className="py-1 pr-3">Group</th><th>n</th><th>Mean</th><th>SD</th></tr>
              </thead>
              <tbody>
                {result.anova.groups.map((g) => (
                  <tr key={g.name} className="border-t border-[color:var(--border)]">
                    <td className="py-1 pr-3">{g.name}</td><td>{g.n}</td><td className="font-mono">{fmt(g.mean)}</td><td className="font-mono">{fmt(g.sd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StatTable title="ANOVA" rows={[
            { label: "F", value: `${fmt(result.anova.F, 4)} ${pStars(result.anova.pValue)}` },
            { label: "df between / within", value: `${result.anova.dfBetween} / ${result.anova.dfWithin}` },
            { label: "p-value", value: fmtP(result.anova.pValue) },
            { label: "SS between / within", value: `${fmt(result.anova.ssBetween)} / ${fmt(result.anova.ssWithin)}` },
            { label: "MS between / within", value: `${fmt(result.anova.msBetween)} / ${fmt(result.anova.msWithin)}` },
            { label: "η² (effect size)", value: fmt(result.anova.etaSquared, 3) },
            { label: "ω²", value: fmt(result.anova.omegaSquared, 3) },
          ]} />
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Group distributions</h5>
              <ChartDownload filename="anova_boxplot">
                <BoxPlot groups={result.groups} />
              </ChartDownload>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Group means (95% CI)</h5>
              <ChartDownload filename="anova_bars">
                <BarChart bars={result.groups.map((g, i) => {
                  const n = g.values.length;
                  const m = n ? g.values.reduce((s, v) => s + v, 0) / n : 0;
                  const sd = n > 1 ? Math.sqrt(g.values.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)) : 0;
                  const moe = 1.96 * sd / Math.sqrt(Math.max(1, n));
                  return { name: g.name, value: m, errLow: m - moe, errHigh: m + moe, color: PALETTE[i % PALETTE.length] };
                })} />
              </ChartDownload>
            </div>
          </div>
          {result.pairs.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Post-hoc ({posthoc})</h5>
              <table className="w-full text-sm">
                <thead className="text-left text-[color:var(--muted)]">
                  <tr>
                    <th className="py-1 pr-3">Pair</th>
                    <th>Mean diff</th>
                    <th>SE</th>
                    <th>p {posthoc === "bonferroni" ? "(adj)" : ""}</th>
                    <th>CI</th>
                  </tr>
                </thead>
                <tbody>
                  {result.pairs.map((p, i) => (
                    <tr key={i} className="border-t border-[color:var(--border)]">
                      <td className="py-1 pr-3">{p.groupA} − {p.groupB}</td>
                      <td className="font-mono">{fmt(p.meanDiff)}</td>
                      <td className="font-mono">{fmt(p.se)}</td>
                      <td>{fmtP(p.pAdjusted ?? p.pValue)} {pStars(p.pAdjusted ?? p.pValue)}</td>
                      <td className="font-mono">[{fmt(p.ciLower)}, {fmt(p.ciUpper)}]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <CsvDownload filename="anova.csv" rows={[
              ["section", "label", "value"],
              ["anova", "F", result.anova.F], ["anova", "df_between", result.anova.dfBetween], ["anova", "df_within", result.anova.dfWithin],
              ["anova", "p", result.anova.pValue], ["anova", "eta2", result.anova.etaSquared], ["anova", "omega2", result.anova.omegaSquared],
              ["groups", "name", "n,mean,sd"],
              ...result.anova.groups.map((g) => ["groups", g.name, `${g.n},${g.mean},${g.sd}`]),
              ["posthoc_method", posthoc, ""],
              ["posthoc", "pair", "mean_diff,se,p,p_adj,ci_lo,ci_hi"],
              ...result.pairs.map((p) => ["posthoc", `${p.groupA}-${p.groupB}`,
                `${p.meanDiff},${p.se},${p.pValue},${p.pAdjusted ?? ""},${p.ciLower},${p.ciUpper}`]),
            ]} />
          </div>
          <p className="text-xs text-[color:var(--muted)]">
            Two-way and repeated-measures ANOVA coming in Phase 2.
          </p>
        </>
      )}
    </div>
  );
}
