"use client";
import { AlertTriangle, Download } from "lucide-react";
import type { AnalysisResponse } from "@/lib/analytics/client";
import { downloadText } from "@/lib/csv";
import { PlotEditor } from "./PlotEditor";

interface Props {
  result: AnalysisResponse;
}

type TableBlock = { headers: string[]; rows: (string | number | null)[][] };

function asTableBlock(value: unknown): TableBlock | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.headers) && Array.isArray(v.rows)) {
    return { headers: v.headers as string[], rows: v.rows as (string | number | null)[][] };
  }
  return null;
}

function ResultTable({ block }: { block: TableBlock }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[color:var(--border)]">
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-[color:var(--border)]">
            {block.headers.map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className="border-b border-[color:var(--border)] last:border-0 hover:bg-gray-50">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-2 py-1 ${typeof cell === "number" ? "text-right font-mono" : ""}`}
                >
                  {cell ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BackendResultPanel({ result }: Props) {
  const postHoc = asTableBlock(result.stats?.post_hoc);
  function downloadCsv() {
    const { headers, rows } = result.table;
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((c) => {
          if (c == null) return "";
          const s = String(c);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(",")
      ),
    ];
    downloadText("analysis_result.csv", lines.join("\n"));
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-1">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-700 border border-amber-100">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Results table */}
      {result.table.headers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide">Results</span>
            <button
              onClick={downloadCsv}
              className="btn btn-ghost text-xs flex items-center gap-1 py-0.5"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <ResultTable block={result.table} />
        </div>
      )}

      {/* Post-hoc pairwise comparisons (e.g. Tukey, Dunn, pairwise Wilcoxon) */}
      {postHoc && postHoc.headers.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide block mb-1">
            Post-hoc comparisons
          </span>
          <ResultTable block={postHoc} />
        </div>
      )}

      {/* Plotly charts */}
      {result.plots.map((plot, i) => (
        <PlotEditor key={i} plot={plot} index={i} />
      ))}

      {/* Meta footer */}
      <p className="text-[10px] text-[color:var(--muted)] text-right">
        n = {result.meta.n.toLocaleString()} · {result.meta.duration_ms} ms · v{result.meta.version}
        {result.cached && " · cached"}
      </p>
    </div>
  );
}
