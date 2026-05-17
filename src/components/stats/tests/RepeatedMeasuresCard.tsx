"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, repeatedMeasuresAnova,
  fmt, fmtP, pStars, variableLabel, type RMAnovaResult,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { LinePlot } from "../LinePlot";
import { Plus, X } from "lucide-react";
import { useExtract } from "../workspace/WorkspaceProvider";

export function RepeatedMeasuresCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [conditions, setConditions] = useState<(Variable | null)[]>([null, null]);

  type Res = { error: string } | { res: RMAnovaResult; names: string[] };
  const result = useMemo<Res | null>(() => {
    const clean = conditions.filter((v): v is Variable => v != null);
    if (clean.length < 2) return null;
    const maps = clean.map((v) => new Map(extractNumeric(sessions, v, questions).map((r) => [r.participantId, r.value])));
    const allPids = new Set<string>();
    for (const m of maps) for (const k of m.keys()) allPids.add(k);
    const wide: number[][] = [];
    for (const pid of allPids) {
      const row = maps.map((m) => m.get(pid));
      if (row.every((v) => v != null && isFinite(v))) wide.push(row as number[]);
    }
    if (wide.length < 3) return { error: "Need ≥3 participants with values across all conditions." };
    const names = clean.map((v) => variableLabel(v, questions));
    return { res: repeatedMeasuresAnova(wide, names), names };
  }, [conditions, sessions, questions]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[color:var(--muted)]">
        One-way within-subjects ANOVA. Pick ≥2 numeric variables that represent the same DV across different conditions
        (e.g. accuracy at 0-back / 1-back / 2-back / 3-back).
      </p>
      <div className="space-y-2">
        {conditions.map((c, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1">
              <VariablePicker catalog={catalog} value={c}
                onChange={(v) => setConditions((arr) => arr.map((x, j) => j === i ? v : x))}
                label={`Condition ${i + 1}`} />
            </div>
            {conditions.length > 2 && (
              <button className="btn btn-ghost" onClick={() => setConditions((arr) => arr.filter((_, j) => j !== i))}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={() => setConditions((arr) => [...arr, null])}>
          <Plus className="w-3.5 h-3.5" /> Add condition
        </button>
      </div>

      {result && "error" in result && <p className="text-sm text-[color:var(--danger)]">{result.error}</p>}
      {result && "res" in result && (
        <>
          <p className="text-sm font-semibold">n = {result.res.n} subjects, k = {result.res.k} conditions</p>
          <StatTable title="ANOVA (within-subjects)" rows={[
            { label: "F", value: `${fmt(result.res.F, 4)} ${pStars(result.res.pValue)}` },
            { label: "df (conditions / error)", value: `${result.res.dfConditions} / ${result.res.dfError}` },
            { label: "p (sphericity assumed)", value: fmtP(result.res.pValue) },
            { label: "Greenhouse-Geisser ε", value: fmt(result.res.greenhouseGeisser ?? NaN, 3) },
            { label: "p (G-G corrected)", value: fmtP(result.res.pGG ?? NaN) },
            { label: "Partial η²", value: fmt(result.res.partialEtaSq, 3) },
            { label: "SS conditions / error / between-subj.", value: `${fmt(result.res.ssConditions)} / ${fmt(result.res.ssError)} / ${fmt(result.res.ssBetweenSubjects)}` },
          ]} />
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Condition means</h5>
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr><th className="py-1 pr-3">Condition</th><th>Mean</th><th>SD</th></tr>
              </thead>
              <tbody>
                {result.res.conditionMeans.map((c, i) => (
                  <tr key={i} className="border-t border-[color:var(--border)]">
                    <td className="py-1 pr-3">{c.name}</td>
                    <td className="font-mono">{fmt(c.mean)}</td>
                    <td className="font-mono">{fmt(c.sd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">
              Condition means (±1 SE)
            </h5>
            <LinePlot
              xAxisCategorical={result.res.conditions}
              series={[{
                name: "Mean",
                points: result.res.conditionMeans.map((c) => {
                  const sem = c.sd / Math.sqrt(Math.max(1, result.res.n));
                  return { x: c.name, y: c.mean, errLow: c.mean - sem, errHigh: c.mean + sem };
                }),
              }]}
              xLabel="condition"
              yLabel="mean"
            />
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload filename="rm_anova.csv" rows={[
              ["F", result.res.F], ["df_cond", result.res.dfConditions], ["df_err", result.res.dfError],
              ["p", result.res.pValue], ["gg_eps", result.res.greenhouseGeisser ?? ""], ["p_gg", result.res.pGG ?? ""],
              ["partial_eta2", result.res.partialEtaSq],
              ["condition", "mean", "sd"],
              ...result.res.conditionMeans.map((c) => [c.name, c.mean, c.sd]),
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
