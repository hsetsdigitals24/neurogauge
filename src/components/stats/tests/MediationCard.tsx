"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, mediation,
  fmt, fmtP, pStars, variableLabel, type MediationResult,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { PathDiagram } from "../PathDiagram";
import { ChartDownload } from "../ChartDownload";
import { useExtract } from "../workspace/WorkspaceProvider";

export function MediationCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [x, setX] = useState<Variable | null>(null);
  const [m, setM] = useState<Variable | null>(null);
  const [y, setY] = useState<Variable | null>(null);
  const [nBoot, setNBoot] = useState(1000);
  const [alpha, setAlpha] = useState(0.05);

  type Res = { error: string } | { res: MediationResult };
  const result = useMemo<Res | null>(() => {
    if (!x || !m || !y) return null;
    const xMap = new Map(extractNumeric(sessions, x, questions).map((r) => [r.participantId, r.value]));
    const mMap = new Map(extractNumeric(sessions, m, questions).map((r) => [r.participantId, r.value]));
    const yMap = new Map(extractNumeric(sessions, y, questions).map((r) => [r.participantId, r.value]));
    const xs: number[] = [], ms: number[] = [], ys: number[] = [];
    for (const pid of xMap.keys()) {
      if (mMap.has(pid) && yMap.has(pid)) {
        xs.push(xMap.get(pid)!); ms.push(mMap.get(pid)!); ys.push(yMap.get(pid)!);
      }
    }
    if (xs.length < 10) return { error: "Need ≥10 complete cases for stable bootstrap CIs." };
    try {
      return { res: mediation(xs, ms, ys, { nBoot, alpha }) };
    } catch (e) {
      return { error: String(e) };
    }
  }, [x, m, y, nBoot, alpha, sessions, questions]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[color:var(--muted)]">
        Tests whether the effect of X on Y is transmitted through M. Reports Baron-Kenny criteria,
        Sobel test, and percentile bootstrap CI for the indirect effect a·b.
      </p>
      <div className="grid md:grid-cols-3 gap-3">
        <VariablePicker catalog={catalog} value={x} onChange={setX} label="X (predictor)" />
        <VariablePicker catalog={catalog} value={m} onChange={setM} label="M (mediator)" />
        <VariablePicker catalog={catalog} value={y} onChange={setY} label="Y (outcome)" />
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="label text-xs">Bootstrap resamples</span>
          <input type="number" step={500} min={200} max={10000} className="input w-32"
            value={nBoot} onChange={(e) => setNBoot(parseInt(e.target.value) || 1000)} />
        </label>
        <label className="block">
          <span className="label text-xs">α (CI width)</span>
          <select className="select" value={String(alpha)} onChange={(e) => setAlpha(parseFloat(e.target.value))}>
            <option value="0.1">0.10</option><option value="0.05">0.05</option><option value="0.01">0.01</option>
          </select>
        </label>
      </div>

      {result && "error" in result && <p className="text-sm text-[color:var(--danger)]">{result.error}</p>}
      {result && "res" in result && (
        <>
          <p className="text-sm font-semibold">
            {x && variableLabel(x, questions)} → {m && variableLabel(m, questions)} → {y && variableLabel(y, questions)} — n = {result.res.n}
          </p>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Path diagram</h5>
            <ChartDownload filename="mediation_path">
              <PathDiagram
                x={x ? variableLabel(x, questions) : "X"}
                m={m ? variableLabel(m, questions) : "M"}
                y={y ? variableLabel(y, questions) : "Y"}
                a={{ label: "a", coef: result.res.aPath.beta, p: result.res.aPath.p }}
                b={{ label: "b", coef: result.res.bPath.beta, p: result.res.bPath.p }}
                c={{ label: "c", coef: result.res.cPath.beta, p: result.res.cPath.p }}
                cPrime={{ label: "c'", coef: result.res.cPrimePath.beta, p: result.res.cPrimePath.p }}
                indirect={{
                  value: result.res.indirect,
                  significant: (result.res.bootstrap?.ciLower ?? 0) * (result.res.bootstrap?.ciUpper ?? 0) > 0,
                }}
              />
            </ChartDownload>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Paths</h5>
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr><th className="py-1 pr-3">Path</th><th>β</th><th>SE</th><th>p</th></tr>
              </thead>
              <tbody>
                {[
                  ["a (X → M)", result.res.aPath],
                  ["b (M → Y | X)", result.res.bPath],
                  ["c (X → Y total)", result.res.cPath],
                  ["c′ (X → Y | M, direct)", result.res.cPrimePath],
                ].map(([name, path], i) => {
                  const p = path as { beta: number; se: number; p: number };
                  return (
                    <tr key={i} className="border-t border-[color:var(--border)]">
                      <td className="py-1 pr-3 font-mono">{String(name)}</td>
                      <td className="font-mono">{fmt(p.beta, 4)}</td>
                      <td className="font-mono">{fmt(p.se, 4)}</td>
                      <td>{fmtP(p.p)} {pStars(p.p)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <StatTable title="Indirect effect (a · b)" rows={[
            { label: "Indirect effect", value: fmt(result.res.indirect, 4) },
            { label: "Sobel z / p", value: `${fmt(result.res.sobel.z, 3)} / ${fmtP(result.res.sobel.pValue)}` },
            { label: `${((1 - alpha) * 100).toFixed(0)}% bootstrap CI`,
              value: `[${fmt(result.res.bootstrap?.ciLower ?? NaN, 4)}, ${fmt(result.res.bootstrap?.ciUpper ?? NaN, 4)}]` },
            { label: "Bootstrap SE", value: fmt(result.res.bootstrap?.bootstrapSE ?? NaN, 4) },
            { label: "Proportion mediated", value: isFinite(result.res.proportionMediated) ? fmt(result.res.proportionMediated, 3) : "—" },
          ]} />
          <StatTable title="Baron & Kenny criteria" rows={[
            { label: "c significant", value: result.res.baronKenny.cSignificant ? "✓" : "✗" },
            { label: "a significant", value: result.res.baronKenny.aSignificant ? "✓" : "✗" },
            { label: "b significant (controlling X)", value: result.res.baronKenny.bSignificant ? "✓" : "✗" },
            { label: "c′ smaller than c", value: result.res.baronKenny.cPrimeReduced ? "✓" : "✗" },
            { label: "Full mediation pattern", value: result.res.baronKenny.fullMediation ? "✓ yes" : "no" },
          ]} />
          <div className="flex justify-end pt-2">
            <CsvDownload filename="mediation.csv" rows={[
              ["n", result.res.n],
              ["path", "beta", "se", "p"],
              ["a", result.res.aPath.beta, result.res.aPath.se, result.res.aPath.p],
              ["b", result.res.bPath.beta, result.res.bPath.se, result.res.bPath.p],
              ["c", result.res.cPath.beta, result.res.cPath.se, result.res.cPath.p],
              ["c_prime", result.res.cPrimePath.beta, result.res.cPrimePath.se, result.res.cPrimePath.p],
              ["indirect", result.res.indirect],
              ["sobel_z", result.res.sobel.z], ["sobel_p", result.res.sobel.pValue],
              ["boot_ci_lo", result.res.bootstrap?.ciLower ?? ""],
              ["boot_ci_hi", result.res.bootstrap?.ciUpper ?? ""],
              ["boot_se", result.res.bootstrap?.bootstrapSE ?? ""],
              ["proportion_mediated", result.res.proportionMediated],
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
