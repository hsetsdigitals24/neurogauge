"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, joinByParticipant, pearson, spearman,
  fmt, fmtP, pStars, variableLabel,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { ScatterPlot } from "../ScatterPlot";
import { ChartDownload } from "../ChartDownload";
import { useExtract } from "../workspace/WorkspaceProvider";

export function CorrelationCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [vx, setVx] = useState<Variable | null>(null);
  const [vy, setVy] = useState<Variable | null>(null);
  const [alpha, setAlpha] = useState(0.05);

  const data = useMemo(() => {
    if (!vx || !vy) return null;
    const a = extractNumeric(sessions, vx, questions);
    const b = extractNumeric(sessions, vy, questions);
    const { a: A, b: B } = joinByParticipant(a, b);
    if (A.length < 3) return null;
    return { x: A, y: B, p: pearson(A, B, alpha), s: spearman(A, B, alpha) };
  }, [vx, vy, alpha, sessions, questions]);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <VariablePicker catalog={catalog} value={vx} onChange={setVx} label="X" />
        <VariablePicker catalog={catalog} value={vy} onChange={setVy} label="Y" />
      </div>
      <label className="block w-32">
        <span className="label text-xs">α</span>
        <select className="select" value={String(alpha)} onChange={(e) => setAlpha(parseFloat(e.target.value))}>
          <option value="0.1">0.10</option><option value="0.05">0.05</option><option value="0.01">0.01</option>
        </select>
      </label>
      {data && (
        <>
          <p className="text-sm font-semibold">
            {vx && variableLabel(vx, questions)} × {vy && variableLabel(vy, questions)} — n = {data.x.length}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <StatTable title="Pearson" rows={[
              { label: "r", value: `${fmt(data.p.r, 4)} ${pStars(data.p.pValue)}` },
              { label: "t", value: fmt(data.p.t, 3) },
              { label: "df", value: data.p.df },
              { label: "p", value: fmtP(data.p.pValue) },
              { label: `${((1 - alpha) * 100).toFixed(0)}% CI`, value: `[${fmt(data.p.ciLower, 3)}, ${fmt(data.p.ciUpper, 3)}]` },
            ]} />
            <StatTable title="Spearman" rows={[
              { label: "ρ", value: `${fmt(data.s.r, 4)} ${pStars(data.s.pValue)}` },
              { label: "t", value: fmt(data.s.t, 3) },
              { label: "df", value: data.s.df },
              { label: "p", value: fmtP(data.s.pValue) },
              { label: `${((1 - alpha) * 100).toFixed(0)}% CI`, value: `[${fmt(data.s.ciLower, 3)}, ${fmt(data.s.ciUpper, 3)}]` },
            ]} />
          </div>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Scatter</h5>
            <ChartDownload filename="correlation_scatter">
              <ScatterPlot x={data.x} y={data.y}
                xLabel={vx ? variableLabel(vx, questions) : "X"} yLabel={vy ? variableLabel(vy, questions) : "Y"} />
            </ChartDownload>
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload filename="correlation.csv" rows={[
              ["method", "r", "t", "df", "p", "ci_lo", "ci_hi"],
              ["pearson", data.p.r, data.p.t, data.p.df, data.p.pValue, data.p.ciLower, data.p.ciUpper],
              ["spearman", data.s.r, data.s.t, data.s.df, data.s.pValue, data.s.ciLower, data.s.ciUpper],
            ]} />
          </div>
        </>
      )}
      {!data && vx && vy && <p className="text-sm text-[color:var(--muted)]">Need ≥3 paired observations.</p>}
    </div>
  );
}
