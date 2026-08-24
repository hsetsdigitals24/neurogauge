"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Download, Sparkles, Loader2, Copy } from "lucide-react";
import type { AnalysisResponse } from "@/lib/analytics/client";
import type { ResultInterpretation } from "@/lib/ai/schemas";
import { downloadText } from "@/lib/csv";
import { notify } from "@/lib/toast";
import { PlotEditor } from "./PlotEditor";

interface Props {
  result: AnalysisResponse;
  /** Context passed to the AI interpreter. When omitted, the button is hidden. */
  analysis?: {
    label: string;
    variables?: Record<string, unknown>;
    options?: Record<string, unknown>;
  };
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

export function BackendResultPanel({ result, analysis }: Props) {
  const postHoc = asTableBlock(result.stats?.post_hoc);

  // Surface analysis warnings as toasts when results arrive (the inline banner below
  // stays as the persistent, contextual record).
  useEffect(() => {
    result.warnings.forEach((w) => notify.warning(w));
  }, [result]);

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

      {/* AI interpretation */}
      {analysis && result.table.headers.length > 0 && (
        <AiInterpretation result={result} analysis={analysis} />
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

// ─── AI interpretation ──────────────────────────────────────────────────────

function AiInterpretation({
  result,
  analysis,
}: {
  result: AnalysisResponse;
  analysis: NonNullable<Props["analysis"]>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResultInterpretation | null>(null);

  async function interpret() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisLabel: analysis.label,
          variables: analysis.variables,
          options: analysis.options,
          result: {
            stats: result.stats,
            table: result.table,
            warnings: result.warnings,
            meta: { n: result.meta.n },
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      setData(json.interpretation as ResultInterpretation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Interpretation failed");
    } finally {
      setLoading(false);
    }
  }

  function copyApa() {
    if (!data?.apa) return;
    navigator.clipboard.writeText(data.apa).then(
      () => notify.success("APA sentence copied"),
      () => notify.error("Copy failed"),
    );
  }

  if (!data) {
    return (
      <div>
        <button
          onClick={interpret}
          disabled={loading}
          className="btn btn-ghost text-xs flex items-center gap-1.5 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? "Interpreting…" : "Interpret with AI"}
        </button>
        {error && (
          <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-700 border border-red-100">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
        <Sparkles className="w-3.5 h-3.5" /> AI interpretation
        {data.significant != null && (
          <span
            className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
              data.significant ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
            }`}
          >
            {data.significant ? "Significant" : "Not significant"}
          </span>
        )}
        <span className="ml-auto text-[10px] font-normal text-[color:var(--muted)]">AI-generated · verify before reporting</span>
      </div>

      <p className="text-xs text-gray-700 leading-relaxed">{data.summary}</p>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-[color:var(--muted)] uppercase tracking-wide">APA write-up</span>
          <button onClick={copyApa} className="btn btn-ghost text-[10px] flex items-center gap-1 py-0.5">
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
        <p className="text-xs text-gray-800 leading-relaxed font-serif bg-white rounded-md border border-indigo-100 p-2">
          {data.apa}
        </p>
      </div>

      {data.effectSize && (
        <p className="text-xs text-gray-700">
          <span className="font-semibold">Effect size:</span> {data.effectSize}
        </p>
      )}

      {data.caveats.length > 0 && (
        <ul className="text-xs text-amber-800 space-y-0.5 list-disc pl-4">
          {data.caveats.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
