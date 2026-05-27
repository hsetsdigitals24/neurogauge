"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, twoWayAnova, fmt, fmtP, pStars, variableLabel, type TwoWayAnovaResult,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker, CategoricalPicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { LinePlot } from "../LinePlot";
import { ChartDownload } from "../ChartDownload";
import { useExtract } from "../workspace/WorkspaceProvider";

export function TwoWayAnovaCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [dv, setDv] = useState<Variable | null>(null);
  const [fa, setFa] = useState<Variable | null>(null);
  const [fb, setFb] = useState<Variable | null>(null);

  type Res = { error: string } | { res: TwoWayAnovaResult };
  const result = useMemo<Res | null>(() => {
    if (!dv || !fa || !fb) return null;
    const y = extractNumeric(sessions, dv, questions);
    const aCat = extractCategorical(sessions, fa, questions);
    const bCat = extractCategorical(sessions, fb, questions);
    const aMap = new Map(aCat.map((r) => [r.participantId, r.value]));
    const bMap = new Map(bCat.map((r) => [r.participantId, r.value]));
    const rows: { a: string; b: string; y: number }[] = [];
    for (const r of y) {
      const a = aMap.get(r.participantId);
      const b = bMap.get(r.participantId);
      if (a != null && b != null) rows.push({ a, b, y: r.value });
    }
    if (rows.length < 6) return { error: "Need at least 6 observations." };
    return { res: twoWayAnova(rows, variableLabel(fa, questions), variableLabel(fb, questions)) };
  }, [dv, fa, fb, sessions, questions]);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <VariablePicker catalog={catalog} value={dv} onChange={setDv} label="Dependent variable" />
        <CategoricalPicker catalog={catalog} value={fa} onChange={setFa} label="Factor A" />
        <CategoricalPicker catalog={catalog} value={fb} onChange={setFb} label="Factor B" />
      </div>
      {result && "error" in result && <p className="text-sm text-[color:var(--danger)]">{result.error}</p>}
      {result && "res" in result && (
        <>
          {!result.res.balanced && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Design is unbalanced — sums of squares are Type I; interpret marginal effects with caution.
            </p>
          )}
          <p className="text-sm font-semibold">
            {dv && variableLabel(dv, questions)} — n = {result.res.n}, grand mean = {fmt(result.res.grandMean)}
          </p>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">ANOVA table</h5>
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr><th className="py-1 pr-3">Source</th><th>df</th><th>SS</th><th>MS</th><th>F</th><th>p</th><th>η²ₚ</th></tr>
              </thead>
              <tbody>
                {result.res.table.map((r, i) => (
                  <tr key={i} className="border-t border-[color:var(--border)]">
                    <td className="py-1 pr-3 font-semibold">{r.source}</td>
                    <td className="font-mono">{r.df}</td>
                    <td className="font-mono">{fmt(r.ss)}</td>
                    <td className="font-mono">{isFinite(r.ms) ? fmt(r.ms) : "—"}</td>
                    <td className="font-mono">{isFinite(r.F) ? `${fmt(r.F, 3)} ${pStars(r.pValue)}` : "—"}</td>
                    <td>{isFinite(r.pValue) ? fmtP(r.pValue) : "—"}</td>
                    <td className="font-mono">{isFinite(r.partialEtaSq) ? fmt(r.partialEtaSq, 3) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Cell means (n, mean, SD)</h5>
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr><th className="py-1 pr-3">A × B</th><th>n</th><th>Mean</th><th>SD</th></tr>
              </thead>
              <tbody>
                {result.res.cellMeans.map((c, i) => (
                  <tr key={i} className="border-t border-[color:var(--border)]">
                    <td className="py-1 pr-3">{c.a} × {c.b}</td>
                    <td>{c.n}</td>
                    <td className="font-mono">{fmt(c.mean)}</td>
                    <td className="font-mono">{fmt(c.sd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Interaction plot</h5>
            <ChartDownload filename="anova2_interaction">
              <LinePlot
                xAxisCategorical={result.res.levelsA}
                series={result.res.levelsB.map((bL) => ({
                  name: bL,
                  points: result.res.levelsA.map((aL) => {
                    const c = result.res.cellMeans.find((cm) => cm.a === aL && cm.b === bL);
                    return { x: aL, y: c?.mean ?? NaN };
                  }).filter((p) => isFinite(p.y)),
                }))}
                xLabel={result.res.factorA}
                yLabel="cell mean"
              />
            </ChartDownload>
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload filename="two_way_anova.csv" rows={[
              ["source", "df", "ss", "ms", "F", "p", "partial_eta_sq"],
              ...result.res.table.map((r) => [r.source, r.df, r.ss, r.ms, r.F, r.pValue, r.partialEtaSq]),
              ["cell", "n", "mean", "sd"],
              ...result.res.cellMeans.map((c) => [`${c.a}×${c.b}`, c.n, c.mean, c.sd]),
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
