"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, mcDonaldOmega,
  fmt, variableLabel, type OmegaResult,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { BarChart } from "../BarChart";
import { Plus, X } from "lucide-react";
import { useExtract } from "../workspace/WorkspaceProvider";

export function OmegaCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [items, setItems] = useState<(Variable | null)[]>([null, null, null]);

  type Res = { error: string } | { res: OmegaResult };
  const result = useMemo<Res | null>(() => {
    const clean = items.filter((v): v is Variable => v != null);
    if (clean.length < 2) return null;
    const maps = clean.map((v) => new Map(extractNumeric(sessions, v, questions).map((r) => [r.participantId, r.value])));
    const allPids = new Set<string>();
    for (const m of maps) for (const k of m.keys()) allPids.add(k);
    const rows: number[][] = [];
    for (const pid of allPids) {
      const row = maps.map((m) => m.get(pid));
      if (row.every((v) => v != null && isFinite(v))) rows.push(row as number[]);
    }
    if (rows.length < 3) return { error: "Need ≥3 complete cases." };
    return { res: mcDonaldOmega(rows, clean.map((v) => variableLabel(v, questions))) };
  }, [items, sessions, questions]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[color:var(--muted)]">
        McDonald&apos;s ω indexes reliability under a one-factor model. Pick ≥2 items measuring the same construct.
      </p>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1">
              <VariablePicker catalog={catalog} value={it}
                onChange={(v) => setItems((arr) => arr.map((x, j) => j === i ? v : x))}
                label={`Item ${i + 1}`} />
            </div>
            {items.length > 2 && (
              <button className="btn btn-ghost" onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={() => setItems((arr) => [...arr, null])}>
          <Plus className="w-3.5 h-3.5" /> Add item
        </button>
      </div>
      {result && "error" in result && <p className="text-sm text-[color:var(--danger)]">{result.error}</p>}
      {result && "res" in result && (
        <>
          <StatTable rows={[
            { label: "n", value: result.res.n },
            { label: "k (items)", value: result.res.k },
            { label: "McDonald's ω", value: fmt(result.res.omega, 3) },
          ]} />
          <p className="text-xs text-[color:var(--muted)]">{result.res.notes}</p>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Loadings</h5>
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr><th className="py-1 pr-3">Item</th><th>λ (loading)</th><th>Uniqueness</th></tr>
              </thead>
              <tbody>
                {result.res.loadings.map((l, i) => (
                  <tr key={i} className="border-t border-[color:var(--border)]">
                    <td className="py-1 pr-3">{l.name}</td>
                    <td className="font-mono">{fmt(l.lambda, 3)}</td>
                    <td className="font-mono">{fmt(l.uniqueness, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Factor loadings</h5>
            <BarChart
              bars={result.res.loadings.map((l) => ({ name: l.name, value: l.lambda }))}
              refLines={[{ y: 0.7, label: "λ ≥ .70", color: "#10b981" }]}
              yLabel="λ"
            />
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload filename="omega.csv" rows={[
              ["omega", result.res.omega], ["n", result.res.n], ["k", result.res.k],
              ["item", "lambda", "uniqueness"],
              ...result.res.loadings.map((l) => [l.name, l.lambda, l.uniqueness]),
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
