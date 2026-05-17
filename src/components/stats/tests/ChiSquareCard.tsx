"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, chiSquareIndependence, contingencyTable,
  fmt, fmtP, pStars, variableLabel,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { CategoricalPicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { HeatMap } from "../HeatMap";
import { useExtract } from "../workspace/WorkspaceProvider";

export function ChiSquareCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [vr, setVr] = useState<Variable | null>(null);
  const [vc, setVc] = useState<Variable | null>(null);

  const result = useMemo(() => {
    if (!vr || !vc) return null;
    const rows = extractCategorical(sessions, vr, questions);
    const cols = extractCategorical(sessions, vc, questions);
    const map = new Map(rows.map((r) => [r.participantId, r.value]));
    const rArr: string[] = [], cArr: string[] = [];
    for (const c of cols) {
      const rv = map.get(c.participantId);
      if (rv != null) { rArr.push(rv); cArr.push(c.value); }
    }
    if (rArr.length < 5) return { error: "Need at least 5 observations." };
    const { rowLabels, colLabels, table } = contingencyTable(rArr, cArr);
    const chi = chiSquareIndependence(table, rowLabels, colLabels);
    return chi;
  }, [vr, vc, sessions, questions]);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <CategoricalPicker catalog={catalog} value={vr} onChange={setVr} label="Rows (categorical)" />
        <CategoricalPicker catalog={catalog} value={vc} onChange={setVc} label="Columns (categorical)" />
      </div>
      {result && "error" in result && <p className="text-sm text-[color:var(--danger)]">{result.error}</p>}
      {result && !("error" in result) && (
        <>
          <p className="text-sm font-semibold">
            {vr && variableLabel(vr, questions)} × {vc && variableLabel(vc, questions)} — n = {result.n}
          </p>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Observed (Expected)</h5>
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr><th className="py-1 pr-3"></th>{result.colLabels?.map((c) => <th key={c} className="pr-3">{c}</th>)}</tr>
              </thead>
              <tbody>
                {result.observed.map((row, i) => (
                  <tr key={i} className="border-t border-[color:var(--border)]">
                    <td className="py-1 pr-3 font-semibold">{result.rowLabels?.[i]}</td>
                    {row.map((v, j) => (
                      <td key={j} className="pr-3 font-mono">
                        {v} <span className="text-[color:var(--muted)] text-xs">({fmt(result.expected[i][j], 1)})</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Observed counts</h5>
              <HeatMap matrix={result.observed} rowLabels={result.rowLabels ?? []} colLabels={result.colLabels ?? []}
                valueFormat={(v) => v.toString()} />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Std. residuals (O−E)/√E</h5>
              <HeatMap
                matrix={result.observed.map((row, i) => row.map((v, j) => {
                  const e = result.expected[i][j];
                  return e > 0 ? (v - e) / Math.sqrt(e) : 0;
                }))}
                rowLabels={result.rowLabels ?? []} colLabels={result.colLabels ?? []}
                valueFormat={(v) => v.toFixed(2)} />
            </div>
          </div>
          <StatTable rows={[
            { label: "χ²", value: `${fmt(result.chi2, 4)} ${pStars(result.pValue)}` },
            { label: "df", value: result.df },
            { label: "p-value", value: fmtP(result.pValue) },
            { label: "Cramér's V", value: fmt(result.cramersV, 3) },
          ]} />
          <div className="flex justify-end pt-2">
            <CsvDownload filename="chisquare.csv" rows={[
              ["chi2", result.chi2], ["df", result.df], ["p", result.pValue], ["cramers_v", result.cramersV ?? ""],
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
