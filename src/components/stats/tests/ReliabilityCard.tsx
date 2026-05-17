"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, cronbachAlpha,
  fmt, variableLabel, type CronbachResult,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { BarChart } from "../BarChart";
import { Plus, X } from "lucide-react";
import { useExtract } from "../workspace/WorkspaceProvider";

export function ReliabilityCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [items, setItems] = useState<(Variable | null)[]>([null, null, null]);

  type Res = { error: string } | { res: CronbachResult };
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
    if (rows.length < 2) return { error: "Not enough complete rows." };
    return { res: cronbachAlpha(rows, clean.map((v) => variableLabel(v, questions))) };
  }, [items, sessions, questions]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[color:var(--muted)]">
        Pick ≥2 items measuring the same construct (e.g. all NASA-TLX subscales). McDonald&apos;s ω deferred to Phase 2.
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
            { label: "n (complete cases)", value: result.res.n },
            { label: "k (items)", value: result.res.k },
            { label: "Cronbach α (raw)", value: fmt(result.res.alpha, 3) },
            { label: "Cronbach α (standardized)", value: fmt(result.res.standardizedAlpha, 3) },
          ]} />
          <div>
            <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Item analysis</h5>
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr><th className="py-1 pr-3">Item</th><th>Item-total r</th><th>α if deleted</th></tr>
              </thead>
              <tbody>
                {result.res.items.map((it, i) => (
                  <tr key={i} className="border-t border-[color:var(--border)]">
                    <td className="py-1 pr-3">{it.name}</td>
                    <td className="font-mono">{fmt(it.itemTotalR, 3)}</td>
                    <td className="font-mono">{fmt(it.alphaIfDeleted, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Item-total correlation</h5>
              <BarChart bars={result.res.items.map((it) => ({ name: it.name, value: it.itemTotalR }))} />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">α if item deleted</h5>
              <BarChart
                bars={result.res.items.map((it) => ({ name: it.name, value: it.alphaIfDeleted }))}
                refLines={[{ y: result.res.alpha, label: `current α = ${result.res.alpha.toFixed(3)}` }]}
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload filename="cronbach.csv" rows={[
              ["alpha", result.res.alpha], ["std_alpha", result.res.standardizedAlpha],
              ["n", result.res.n], ["k", result.res.k],
              ["item", "item_total_r", "alpha_if_deleted"],
              ...result.res.items.map((it) => [it.name, it.itemTotalR, it.alphaIfDeleted]),
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
