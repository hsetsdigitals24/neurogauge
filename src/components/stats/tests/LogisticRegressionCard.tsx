"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, logisticRegression,
  fmt, fmtP, pStars, variableLabel, type LogisticRegressionResult,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker, CategoricalPicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { ForestPlot } from "../ForestPlot";
import { ChartDownload } from "../ChartDownload";
import { Plus, X } from "lucide-react";
import { useExtract } from "../workspace/WorkspaceProvider";

export function LogisticRegressionCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [dv, setDv] = useState<Variable | null>(null);
  const [positiveValue, setPositiveValue] = useState("");
  const [ivs, setIvs] = useState<(Variable | null)[]>([null]);
  const [alpha, setAlpha] = useState(0.05);

  type Res = { error: string; uniq?: string[] } | { reg: LogisticRegressionResult; uniq: string[]; pos: string };
  const result = useMemo<Res | null>(() => {
    if (!dv) return null;
    const cleanIvs = ivs.filter((v): v is Variable => v != null);
    if (cleanIvs.length === 0) return null;
    const rawY = extractCategorical(sessions, dv, questions);
    const uniq = Array.from(new Set(rawY.map((r) => r.value))).sort();
    if (uniq.length !== 2 && !positiveValue) {
      return { error: `Outcome has ${uniq.length} categories. Pick the "positive" value explicitly.`, uniq };
    }
    const pos = positiveValue || uniq[1];
    const yMap = new Map(rawY.map((r) => [r.participantId, r.value === pos ? 1 : 0]));
    const ivData = cleanIvs.map((iv) => new Map(extractNumeric(sessions, iv, questions).map((r) => [r.participantId, r.value])));
    const y: number[] = [], X: number[][] = [];
    for (const pid of yMap.keys()) {
      const row = ivData.map((m) => m.get(pid));
      if (row.every((v) => v != null && isFinite(v))) {
        y.push(yMap.get(pid)!);
        X.push(row as number[]);
      }
    }
    if (y.length < cleanIvs.length + 2) return { error: "Not enough rows." };
    try {
      return { reg: logisticRegression(y, X, cleanIvs.map((iv) => variableLabel(iv, questions)), alpha), uniq, pos };
    } catch (e) {
      return { error: String(e), uniq };
    }
  }, [dv, ivs, alpha, positiveValue, sessions, questions]);

  return (
    <div className="space-y-4">
      <CategoricalPicker catalog={catalog} value={dv} onChange={setDv} label="Binary outcome (Y)" />
      {result && "uniq" in result && result.uniq && (
        <label className="block">
          <span className="label text-xs">Positive class</span>
          <select className="select" value={positiveValue} onChange={(e) => setPositiveValue(e.target.value)}>
            <option value="">(auto)</option>
            {result.uniq.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
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
          <p className="text-sm font-semibold">Positive class: {result.pos}, n = {result.reg.n}</p>
          <StatTable rows={[
            { label: "McFadden pseudo-R²", value: fmt(result.reg.pseudoR2, 3) },
            { label: "Log-likelihood", value: fmt(result.reg.logLik, 2) },
            { label: "Iterations", value: `${result.reg.iterations} ${result.reg.converged ? "(converged)" : "(did not converge)"}` },
            { label: "Accuracy @ 0.5", value: fmt(result.reg.accuracy, 3) },
            { label: "Confusion (TP/FP/TN/FN)",
              value: `${result.reg.confusion.TP} / ${result.reg.confusion.FP} / ${result.reg.confusion.TN} / ${result.reg.confusion.FN}` },
          ]} />
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Coefficients</h5>
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr>
                  <th className="py-1 pr-3">Term</th>
                  <th>β</th><th>SE</th><th>z</th><th>p</th><th>OR</th>
                  <th>{((1 - alpha) * 100).toFixed(0)}% CI (OR)</th>
                </tr>
              </thead>
              <tbody>
                {result.reg.coefficients.map((c, i) => (
                  <tr key={i} className="border-t border-[color:var(--border)]">
                    <td className="py-1 pr-3">{c.name}</td>
                    <td className="font-mono">{fmt(c.beta, 4)}</td>
                    <td className="font-mono">{fmt(c.se, 4)}</td>
                    <td className="font-mono">{fmt(c.z, 3)}</td>
                    <td>{fmtP(c.pValue)} {pStars(c.pValue)}</td>
                    <td className="font-mono">{fmt(c.oddsRatio, 3)}</td>
                    <td className="font-mono">[{fmt(c.ciLower, 3)}, {fmt(c.ciUpper, 3)}]</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">
              Odds ratios ({((1 - alpha) * 100).toFixed(0)}% CI)
            </h5>
            <ChartDownload filename="logistic_forest">
              <ForestPlot
                rows={result.reg.coefficients.filter((c) => c.name !== "(Intercept)").map((c) => ({
                  name: c.name, value: c.oddsRatio, ciLow: c.ciLower, ciHigh: c.ciUpper, significant: c.pValue < 0.05,
                }))}
                refValue={1} xLabel="Odds ratio"
              />
            </ChartDownload>
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload filename="logistic.csv" rows={[
              ["pseudo_r2", result.reg.pseudoR2], ["log_lik", result.reg.logLik],
              ["accuracy", result.reg.accuracy],
              ["term", "beta", "se", "z", "p", "or", "ci_lo", "ci_hi"],
              ...result.reg.coefficients.map((c) => [c.name, c.beta, c.se, c.z, c.pValue, c.oddsRatio, c.ciLower, c.ciUpper]),
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
