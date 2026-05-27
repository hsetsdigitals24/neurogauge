"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, groupByCategory,
  cohenD, etaSquared, oddsRatio, oneWayAnova,
  fmt, variableLabel, contingencyTable, type EffectSize,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker, CategoricalPicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { BarChart } from "../BarChart";
import { useExtract } from "../workspace/WorkspaceProvider";

type Mode = "cohen-d" | "eta-squared" | "odds-ratio";

function refLinesFor(mode: Mode): { y: number; label: string; color?: string }[] {
  if (mode === "cohen-d") return [
    { y: 0.2, label: "small (0.2)", color: "#64748b" },
    { y: 0.5, label: "medium (0.5)", color: "#f59e0b" },
    { y: 0.8, label: "large (0.8)", color: "#ef4444" },
  ];
  if (mode === "eta-squared") return [
    { y: 0.01, label: "small (.01)", color: "#64748b" },
    { y: 0.06, label: "medium (.06)", color: "#f59e0b" },
    { y: 0.14, label: "large (.14)", color: "#ef4444" },
  ];
  return [
    { y: 1, label: "no effect (1)", color: "#64748b" },
    { y: 1.5, label: "small (1.5)", color: "#f59e0b" },
    { y: 3, label: "large (3)", color: "#ef4444" },
  ];
}

export function EffectSizeCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [mode, setMode] = useState<Mode>("cohen-d");
  const [dv, setDv] = useState<Variable | null>(null);
  const [iv, setIv] = useState<Variable | null>(null);

  type Res =
    | { error: string }
    | { kind: "cohen-d"; value: EffectSize; groupNames: [string, string] }
    | { kind: "eta-squared"; value: EffectSize }
    | { kind: "odds-ratio"; value: EffectSize; rowLabels: string[]; colLabels: string[] };
  const result = useMemo<Res | null>(() => {
    if (!dv || !iv) return null;
    try {
      if (mode === "cohen-d") {
        const vals = extractNumeric(sessions, dv, questions);
        const cats = extractCategorical(sessions, iv, questions);
        const groups = groupByCategory(vals, cats);
        if (groups.length !== 2) return { error: `Need exactly 2 groups; found ${groups.length}.` };
        return { kind: "cohen-d" as const, value: cohenD(groups[0].values, groups[1].values), groupNames: [groups[0].name, groups[1].name] as [string, string] };
      }
      if (mode === "eta-squared") {
        const vals = extractNumeric(sessions, dv, questions);
        const cats = extractCategorical(sessions, iv, questions);
        const groups = groupByCategory(vals, cats);
        if (groups.length < 2) return { error: `Need ≥2 groups; found ${groups.length}.` };
        const a = oneWayAnova(groups);
        return { kind: "eta-squared" as const, value: etaSquared(a.ssBetween, a.ssBetween + a.ssWithin) };
      }
      // odds-ratio: both vars categorical, 2x2
      const dvCat = extractCategorical(sessions, dv, questions);
      const ivCat = extractCategorical(sessions, iv, questions);
      const dvMap = new Map(dvCat.map((r) => [r.participantId, r.value]));
      const r: string[] = [], c: string[] = [];
      for (const x of ivCat) {
        const y = dvMap.get(x.participantId);
        if (y != null) { r.push(x.value); c.push(y); }
      }
      const { rowLabels, colLabels, table } = contingencyTable(r, c);
      if (rowLabels.length !== 2 || colLabels.length !== 2) return { error: `Need 2×2 table; got ${rowLabels.length}×${colLabels.length}.` };
      return { kind: "odds-ratio" as const, value: oddsRatio(table as [[number, number], [number, number]]), rowLabels, colLabels };
    } catch (e) {
      return { error: String(e) };
    }
  }, [mode, dv, iv, sessions, questions]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["cohen-d", "eta-squared", "odds-ratio"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`btn ${mode === m ? "btn-primary" : "btn-ghost"} text-xs`}>
            {m === "cohen-d" ? "Cohen's d" : m === "eta-squared" ? "η² (ANOVA)" : "Odds ratio"}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {mode === "odds-ratio"
          ? <CategoricalPicker catalog={catalog} value={dv} onChange={setDv} label="Outcome (categorical, 2 levels)" />
          : <VariablePicker catalog={catalog} value={dv} onChange={setDv} label="Numeric variable" />}
        <CategoricalPicker catalog={catalog} value={iv} onChange={setIv} label={mode === "cohen-d" ? "Group by (2 groups)" : "Group by"} />
      </div>
      {result && "error" in result && result.error && <p className="text-sm text-[color:var(--danger)]">{result.error}</p>}
      {result && "value" in result && (
        <>
          <StatTable rows={[
            { label: result.value.name, value: fmt(result.value.value, 3) },
            { label: "Interpretation", value: result.value.interpretation },
            ...("groupNames" in result && result.groupNames ? [{ label: "Groups", value: result.groupNames.join(" vs ") }] : []),
          ]} />
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Magnitude</h5>
            <BarChart
              bars={[{ name: result.value.name, value: result.value.value, color: "#6366f1" }]}
              refLines={refLinesFor(mode)}
              baseline={mode === "odds-ratio" ? 1 : 0}
            />
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload filename="effect_size.csv" rows={[["measure", result.value.name], ["value", result.value.value], ["interpretation", result.value.interpretation]]} />
          </div>
        </>
      )}
    </div>
  );
}
