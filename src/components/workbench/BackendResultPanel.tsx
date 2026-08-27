"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Download, Sparkles, Loader2, Copy, Table2, FileText } from "lucide-react";
import type { AnalysisResponse } from "@/lib/analytics/client";
import type { ResultInterpretation, ApaTable, ResultsSection } from "@/lib/ai/schemas";
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

      {/* AI writing tools: interpret, APA table & figure, results-section draft */}
      {analysis && result.table.headers.length > 0 && (
        <div className="space-y-2">
          <AiInterpretation result={result} analysis={analysis} />
          <ApaTableTool result={result} analysis={analysis} />
          <ResultsDraftTool result={result} analysis={analysis} />
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

// ─── Shared helpers for the AI writing tools ────────────────────────────────

/** The result payload every /api/ai/* result tool posts. */
function aiRequestBody(result: AnalysisResponse, analysis: NonNullable<Props["analysis"]>) {
  return {
    analysisLabel: analysis.label,
    variables: analysis.variables,
    options: analysis.options,
    result: {
      stats: result.stats,
      table: result.table,
      warnings: result.warnings,
      meta: { n: result.meta.n },
    },
  };
}

function copyToClipboard(text: string, label: string) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => notify.success(`${label} copied`),
    () => notify.error("Copy failed"),
  );
}

/** A dashed outline "generate" trigger shared by the APA table + results tools. */
function AiToolButton({
  icon,
  idle,
  busy,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  idle: string;
  busy: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="btn btn-ghost text-xs flex items-center gap-1.5 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {loading ? busy : idle}
    </button>
  );
}

// ─── APA table & figure ─────────────────────────────────────────────────────

function ApaTableTool({
  result,
  analysis,
}: {
  result: AnalysisResponse;
  analysis: NonNullable<Props["analysis"]>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApaTable | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/apa-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiRequestBody(result, analysis)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || `Failed (${res.status})`);
      setData(json.apaTable as ApaTable);
    } catch (e) {
      setError(e instanceof Error ? e.message : "APA table generation failed");
    } finally {
      setLoading(false);
    }
  }

  /** Tab-separated plain text — pastes cleanly into Word/Docs/Excel as a table. */
  function apaAsText(t: ApaTable): string {
    const lines = [
      t.tableNumber,
      t.title,
      "",
      t.columns.map((c) => c.header).join("\t"),
      ...t.rows.map((r) => r.join("\t")),
    ];
    if (t.generalNote) lines.push("", `Note. ${t.generalNote}`);
    return lines.join("\n");
  }

  function download(t: ApaTable) {
    const lines = [
      t.columns.map((c) => c.header).join(","),
      ...t.rows.map((r) =>
        r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","),
      ),
    ];
    downloadText("apa_table.csv", lines.join("\n"));
  }

  if (!data) {
    return (
      <div>
        <AiToolButton
          icon={<Table2 className="w-3.5 h-3.5" />}
          idle="APA table & figure"
          busy="Formatting…"
          loading={loading}
          onClick={generate}
        />
        {error && (
          <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-700 border border-red-100">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
        <Table2 className="w-3.5 h-3.5" /> APA table
        <span className="ml-auto flex items-center gap-2">
          <button onClick={() => copyToClipboard(apaAsText(data), "APA table")} className="btn btn-ghost text-[10px] flex items-center gap-1 py-0.5">
            <Copy className="w-3 h-3" /> Copy
          </button>
          <button onClick={() => download(data)} className="btn btn-ghost text-[10px] flex items-center gap-1 py-0.5">
            <Download className="w-3 h-3" /> CSV
          </button>
        </span>
      </div>

      {/* APA-styled table: number + italic title above, general note below. */}
      <div className="bg-white rounded-md border border-indigo-100 p-3 font-serif">
        <p className="text-xs font-semibold">{data.tableNumber}</p>
        <p className="text-xs italic mb-2">{data.title}</p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr className="border-y border-gray-400">
                {data.columns.map((c, i) => (
                  <th
                    key={i}
                    className={`px-2 py-1 font-semibold ${
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-200 last:border-b-gray-400">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-2 py-1 ${
                        data.columns[j]?.align === "right"
                          ? "text-right tabular-nums"
                          : data.columns[j]?.align === "center"
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.generalNote && (
          <p className="text-[11px] mt-2 leading-snug">
            <span className="italic">Note.</span> {data.generalNote}
          </p>
        )}
      </div>

      {data.figure && (
        <div className="text-xs text-gray-700 bg-white rounded-md border border-indigo-100 p-2 space-y-1">
          <p>
            <span className="font-semibold">Suggested figure:</span> {data.figure.type}
          </p>
          <p className="font-serif">
            <span className="italic">Figure.</span> {data.figure.caption}
          </p>
          <p className="text-[color:var(--muted)]">{data.figure.rationale}</p>
        </div>
      )}

      <p className="text-[10px] text-[color:var(--muted)] text-right">AI-generated · verify every value before reporting</p>
    </div>
  );
}

// ─── Results-section draft ──────────────────────────────────────────────────

function ResultsDraftTool({
  result,
  analysis,
}: {
  result: AnalysisResponse;
  analysis: NonNullable<Props["analysis"]>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResultsSection | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/results-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiRequestBody(result, analysis)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || `Failed (${res.status})`);
      setData(json.resultsSection as ResultsSection);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Results drafting failed");
    } finally {
      setLoading(false);
    }
  }

  function fullText(d: ResultsSection): string {
    const parts = [d.heading, "", ...d.paragraphs];
    if (d.tableCallout) parts.push("", d.tableCallout);
    return parts.join("\n");
  }

  if (!data) {
    return (
      <div>
        <AiToolButton
          icon={<FileText className="w-3.5 h-3.5" />}
          idle="Draft results section"
          busy="Drafting…"
          loading={loading}
          onClick={generate}
        />
        {error && (
          <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-700 border border-red-100">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
        <FileText className="w-3.5 h-3.5" /> Results-section draft
        <button
          onClick={() => copyToClipboard(fullText(data), "Results draft")}
          className="ml-auto btn btn-ghost text-[10px] flex items-center gap-1 py-0.5"
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
      </div>

      <div className="bg-white rounded-md border border-indigo-100 p-3 font-serif space-y-2">
        <p className="text-xs font-semibold italic">{data.heading}</p>
        {data.paragraphs.map((p, i) => (
          <p key={i} className="text-xs text-gray-800 leading-relaxed">{p}</p>
        ))}
        {data.tableCallout && (
          <p className="text-xs text-gray-800 leading-relaxed">{data.tableCallout}</p>
        )}
      </div>

      {data.caveats.length > 0 && (
        <ul className="text-xs text-amber-800 space-y-0.5 list-disc pl-4">
          {data.caveats.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-[color:var(--muted)] text-right">AI-generated · review before submission</p>
    </div>
  );
}
