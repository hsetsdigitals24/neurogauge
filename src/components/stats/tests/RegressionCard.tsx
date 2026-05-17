"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, linearRegression,
  fmt, fmtP, pStars, variableLabel, type LinearRegressionResult,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { ScatterPlot } from "../ScatterPlot";
import { ForestPlot } from "../ForestPlot";
import { Plus, X } from "lucide-react";
import { useExtract } from "../workspace/WorkspaceProvider";

export function RegressionCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [dv, setDv] = useState<Variable | null>(null);
  const [ivs, setIvs] = useState<(Variable | null)[]>([null]);
  const [alpha, setAlpha] = useState(0.05);

  type Res = { error: string } | { reg: LinearRegressionResult; n: number };
  const result = useMemo<Res | null>(() => {
    if (!dv) return null;
    const cleanIvs = ivs.filter((v): v is Variable => v != null);
    if (cleanIvs.length === 0) return null;
    const y = extractNumeric(sessions, dv, questions);
    const ymap = new Map(y.map((r) => [r.participantId, r.value]));
    const ivData = cleanIvs.map((iv) => new Map(extractNumeric(sessions, iv, questions).map((r) => [r.participantId, r.value])));
    const yArr: number[] = [];
    const X: number[][] = [];
    for (const pid of ymap.keys()) {
      const row = ivData.map((m) => m.get(pid));
      if (row.every((v) => v != null && isFinite(v))) {
        yArr.push(ymap.get(pid)!);
        X.push(row as number[]);
      }
    }
    if (yArr.length < cleanIvs.length + 2) return { error: "Not enough rows for this many predictors." };
    try {
      return { reg: linearRegression(yArr, X, cleanIvs.map((iv) => variableLabel(iv, questions)), alpha), n: yArr.length };
    } catch (e) {
      return { error: String(e) };
    }
  }, [dv, ivs, alpha, sessions, questions]);

  return (
    <div className="space-y-4">
      <VariablePicker catalog={catalog} value={dv} onChange={setDv} label="Dependent variable (Y)" />
      <div className="space-y-2">
        <span className="label text-xs">Predictors (X)</span>
        {ivs.map((iv, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1">
              <VariablePicker catalog={catalog} value={iv}
                onChange={(v) => setIvs((arr) => arr.map((x, j) => j === i ? v : x))}
                label={`X${i + 1}`} />
            </div>
            {ivs.length > 1 && (
              <button className="btn btn-ghost" onClick={() => setIvs((arr) => arr.filter((_, j) => j !== i))}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={() => setIvs((arr) => [...arr, null])}>
          <Plus className="w-3.5 h-3.5" /> Add predictor
        </button>
      </div>
      <label className="block w-32">
        <span className="label text-xs">α</span>
        <select className="select" value={String(alpha)} onChange={(e) => setAlpha(parseFloat(e.target.value))}>
          <option value="0.1">0.10</option><option value="0.05">0.05</option><option value="0.01">0.01</option>
        </select>
      </label>

      {result && "error" in result && <p className="text-sm text-[color:var(--danger)]">{result.error}</p>}
      {result && "reg" in result && (
        <>
          <p className="text-sm font-semibold">
            Y = {dv && variableLabel(dv, questions)} — n = {result.n}
          </p>
          <StatTable rows={[
            { label: "R²", value: fmt(result.reg.rSquared, 4) },
            { label: "Adjusted R²", value: fmt(result.reg.adjRSquared, 4) },
            { label: "F", value: `${fmt(result.reg.F, 3)} ${pStars(result.reg.pValueF)}` },
            { label: "df (model / residual)", value: `${result.reg.dfModel} / ${result.reg.dfResidual}` },
            { label: "p-value (F)", value: fmtP(result.reg.pValueF) },
          ]} />
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Coefficients</h5>
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr>
                  <th className="py-1 pr-3">Term</th>
                  <th>β</th><th>SE</th><th>Std. β</th><th>t</th><th>p</th>
                  <th>{((1 - alpha) * 100).toFixed(0)}% CI</th>
                </tr>
              </thead>
              <tbody>
                {result.reg.coefficients.map((c, i) => (
                  <tr key={i} className="border-t border-[color:var(--border)]">
                    <td className="py-1 pr-3">{c.name}</td>
                    <td className="font-mono">{fmt(c.beta, 4)}</td>
                    <td className="font-mono">{fmt(c.se, 4)}</td>
                    <td className="font-mono">{c.stdBeta != null ? fmt(c.stdBeta, 3) : "—"}</td>
                    <td className="font-mono">{fmt(c.t, 3)}</td>
                    <td>{fmtP(c.pValue)} {pStars(c.pValue)}</td>
                    <td className="font-mono">[{fmt(c.ciLower, 3)}, {fmt(c.ciUpper, 3)}]</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">
                Coefficients ({((1 - alpha) * 100).toFixed(0)}% CI)
              </h5>
              <ForestPlot
                rows={result.reg.coefficients.filter((c) => c.name !== "(Intercept)").map((c) => ({
                  name: c.name, value: c.beta, ciLow: c.ciLower, ciHigh: c.ciUpper, significant: c.pValue < 0.05,
                }))}
                refValue={0} xLabel="β"
              />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Residuals vs Fitted</h5>
              <ScatterPlot x={result.reg.fitted} y={result.reg.residuals} xLabel="Fitted" yLabel="Residual" showLine={false} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload filename="regression.csv" rows={[
              ["r_squared", result.reg.rSquared], ["adj_r_squared", result.reg.adjRSquared],
              ["F", result.reg.F], ["df_model", result.reg.dfModel], ["df_residual", result.reg.dfResidual],
              ["p_F", result.reg.pValueF],
              ["term", "beta", "se", "std_beta", "t", "p", "ci_lo", "ci_hi"],
              ...result.reg.coefficients.map((c) => [c.name, c.beta, c.se, c.stdBeta ?? "", c.t, c.pValue, c.ciLower, c.ciUpper]),
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
