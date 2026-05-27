"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, groupByCategory, joinByParticipant,
  oneSampleT, independentT, pairedT, fmt, fmtP, pStars, variableLabel, cohenD,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker, CategoricalPicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { BoxPlot } from "../BoxPlot";
import { BarChart } from "../BarChart";
import { ChartDownload } from "../ChartDownload";
import { useExtract } from "../workspace/WorkspaceProvider";

type Mode = "one-sample" | "independent" | "paired";

type ChartData =
  | { kind: "one"; name: string; values: number[] }
  | { kind: "groups"; groups: { name: string; values: number[] }[] }
  | { kind: "paired"; groups: { name: string; values: number[] }[] };

function meanBars(c: ChartData) {
  const groups = c.kind === "one"
    ? [{ name: c.name, values: c.values }]
    : c.groups;
  return groups.map((g, i) => {
    const n = g.values.length;
    const m = n ? g.values.reduce((s, v) => s + v, 0) / n : 0;
    const sd = n > 1 ? Math.sqrt(g.values.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)) : 0;
    const sem = n > 0 ? sd / Math.sqrt(n) : 0;
    const moe = 1.96 * sem;
    return { name: g.name, value: m, errLow: m - moe, errHigh: m + moe, color: i === 0 ? "#6366f1" : "#10b981" };
  });
}

export function TTestCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [mode, setMode] = useState<Mode>("independent");
  const [v1, setV1] = useState<Variable | null>(null);
  const [v2, setV2] = useState<Variable | null>(null);
  const [groupVar, setGroupVar] = useState<Variable | null>(null);
  const [mu0, setMu0] = useState(0);
  const [alpha, setAlpha] = useState(0.05);
  const [variant, setVariant] = useState<"welch" | "student">("welch");

  const chartData = useMemo(() => {
    try {
      if (mode === "one-sample" && v1) {
        const vals = extractNumeric(sessions, v1, questions).map((r) => r.value);
        return { kind: "one" as const, name: variableLabel(v1, questions), values: vals };
      }
      if (mode === "independent" && v1 && groupVar) {
        const vals = extractNumeric(sessions, v1, questions);
        const cats = extractCategorical(sessions, groupVar, questions);
        const groups = groupByCategory(vals, cats);
        return { kind: "groups" as const, groups: groups.slice(0, 2) };
      }
      if (mode === "paired" && v1 && v2) {
        const a = extractNumeric(sessions, v1, questions);
        const b = extractNumeric(sessions, v2, questions);
        const { a: A, b: B } = joinByParticipant(a, b);
        return { kind: "paired" as const,
          groups: [
            { name: variableLabel(v1, questions), values: A },
            { name: variableLabel(v2, questions), values: B },
          ] };
      }
    } catch { /* */ }
    return null;
  }, [mode, v1, v2, groupVar, sessions, questions]);

  const result = useMemo(() => {
    try {
      if (mode === "one-sample" && v1) {
        const vals = extractNumeric(sessions, v1, questions).map((r) => r.value);
        if (vals.length < 2) return null;
        return oneSampleT(vals, mu0, alpha);
      }
      if (mode === "independent" && v1 && groupVar) {
        const vals = extractNumeric(sessions, v1, questions);
        const cats = extractCategorical(sessions, groupVar, questions);
        const groups = groupByCategory(vals, cats);
        if (groups.length !== 2) return { error: `Need exactly 2 groups; found ${groups.length}.` };
        const r = independentT(groups[0].values, groups[1].values, alpha, variant);
        return { ...r, groupNames: [groups[0].name, groups[1].name], cohen: cohenD(groups[0].values, groups[1].values) };
      }
      if (mode === "paired" && v1 && v2) {
        const a = extractNumeric(sessions, v1, questions);
        const b = extractNumeric(sessions, v2, questions);
        const { a: A, b: B } = joinByParticipant(a, b);
        if (A.length < 2) return { error: "Not enough paired observations." };
        return pairedT(A, B, alpha);
      }
    } catch (e) {
      return { error: String(e) };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, v1, v2, groupVar, mu0, alpha, variant, sessions, questions]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["one-sample", "independent", "paired"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`btn ${mode === m ? "btn-primary" : "btn-ghost"} text-xs`}>
            {m === "one-sample" ? "One-sample" : m === "independent" ? "Independent" : "Paired"}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <VariablePicker catalog={catalog} value={v1} onChange={setV1} label="Variable" />
        {mode === "paired" && <VariablePicker catalog={catalog} value={v2} onChange={setV2} label="Second variable (paired)" />}
        {mode === "independent" && <CategoricalPicker catalog={catalog} value={groupVar} onChange={setGroupVar} label="Group by (must yield 2 groups)" />}
        {mode === "one-sample" && (
          <label className="block">
            <span className="label text-xs">Hypothesised mean (μ₀)</span>
            <input type="number" className="input" value={mu0} onChange={(e) => setMu0(parseFloat(e.target.value) || 0)} />
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="label text-xs">α (significance)</span>
          <select className="select" value={String(alpha)} onChange={(e) => setAlpha(parseFloat(e.target.value))}>
            <option value="0.1">0.10</option>
            <option value="0.05">0.05</option>
            <option value="0.01">0.01</option>
          </select>
        </label>
        {mode === "independent" && (
          <label className="block">
            <span className="label text-xs">Variant</span>
            <select className="select" value={variant} onChange={(e) => setVariant(e.target.value as "welch" | "student")}>
              <option value="welch">Welch (unequal var.)</option>
              <option value="student">Student (pooled)</option>
            </select>
          </label>
        )}
      </div>

      {result && "error" in result && result.error && (
        <p className="text-sm text-[color:var(--danger)]">{result.error}</p>
      )}
      {result && !("error" in result) && (
        <>
          <p className="text-sm font-semibold">
            {v1 && variableLabel(v1, questions)}{mode === "paired" && v2 ? ` vs ${variableLabel(v2, questions)}` : ""}
            {"groupNames" in result && result.groupNames ? ` — ${result.groupNames[0]} vs ${result.groupNames[1]}` : ""}
          </p>
          <StatTable rows={[
            { label: "t", value: `${fmt(result.t, 4)} ${pStars(result.pValue)}` },
            { label: "df", value: fmt(result.df, 2) },
            { label: "p-value", value: fmtP(result.pValue) },
            { label: "Mean difference", value: fmt(result.meanDiff, 4) },
            { label: "SE", value: fmt(result.se, 4) },
            { label: `${((1 - alpha) * 100).toFixed(0)}% CI of difference`, value: `[${fmt(result.ciLower, 4)}, ${fmt(result.ciUpper, 4)}]` },
            { label: "Cohen's d", value: fmt(result.cohenD, 3) },
            ...("variant" in result && result.variant ? [{ label: "Variant", value: result.variant }] : []),
            ...("groupNames" in result && result.groupNames ? [
              { label: result.groupNames[0], value: `n=${result.n1}, M=${fmt(result.mean1)}, SD=${fmt(result.sd1)}` },
              { label: result.groupNames[1], value: `n=${result.n2}, M=${fmt(result.mean2)}, SD=${fmt(result.sd2)}` },
            ] : []),
          ]} />
          {chartData && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Distribution</h5>
                <ChartDownload filename="ttest_boxplot">
                  {chartData.kind === "one"
                    ? <BoxPlot groups={[{ name: chartData.name, values: chartData.values }]} />
                    : <BoxPlot groups={chartData.groups} />}
                </ChartDownload>
              </div>
              <div>
                <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Means with {((1 - alpha) * 100).toFixed(0)}% CI</h5>
                <ChartDownload filename="ttest_bars">
                  <BarChart bars={meanBars(chartData)} />
                </ChartDownload>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <CsvDownload filename="ttest.csv" rows={[
              ["test", result.test], ["variant", "variant" in result ? result.variant ?? "" : ""],
              ["t", result.t], ["df", result.df], ["p", result.pValue],
              ["mean_diff", result.meanDiff], ["se", result.se],
              ["ci_lower", result.ciLower], ["ci_upper", result.ciUpper], ["alpha", alpha],
              ["cohen_d", result.cohenD ?? ""],
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
