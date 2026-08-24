"use client";
import { useState } from "react";
import { Sparkles, Loader2, X, ArrowRight } from "lucide-react";
import { useWorkspace } from "@/components/stats/workspace/WorkspaceProvider";
import type { ColumnSchema } from "@/lib/analytics/dataset";
import type { TestRecommendation } from "@/lib/ai/schemas";
import type { DialogKey } from "@/lib/stats/workspace";

interface Props {
  schema: Record<string, ColumnSchema>;
  n: number;
  onClose: () => void;
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-200 text-gray-600",
};

/** Right-hand slide-over: describe a research question, get ranked test
 *  recommendations mapped onto the workbench's analyses. Picking one opens the
 *  matching analysis dialog (pre-filled by the researcher using the shown map). */
export function AiStatistician({ schema, n, onClose }: Props) {
  const ws = useWorkspace();
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<TestRecommendation[] | null>(null);

  async function recommend() {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/recommend-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema, n, question, notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      setRecs(json.recommendations as TestRecommendation[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recommendation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-y-0 right-0 z-40 w-[400px] max-w-full bg-white border-l border-[color:var(--border)] shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--border)] shrink-0">
        <Sparkles className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold">AI Statistician</h3>
        <button onClick={onClose} className="ml-auto btn btn-ghost p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Prompt */}
        <div className="space-y-2">
          <label className="block">
            <span className="label text-xs">What do you want to test?</span>
            <textarea
              className="input text-xs resize-y"
              rows={3}
              placeholder="e.g. Does reaction time differ between the high-load and low-load groups?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label text-xs">Extra context (optional)</span>
            <input
              className="input text-xs"
              placeholder="design, hypotheses, known issues…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button
            onClick={recommend}
            disabled={loading || !question.trim()}
            className="btn btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? "Thinking…" : "Recommend a test"}
          </button>
          <p className="text-[10px] text-[color:var(--muted)]">
            Based on {Object.keys(schema).length} variables · {n.toLocaleString()} rows. Suggestions are AI-generated —
            confirm assumptions before reporting.
          </p>
        </div>

        {error && (
          <div className="p-2 bg-red-50 rounded-lg text-xs text-red-700 border border-red-100">{error}</div>
        )}

        {/* Recommendations */}
        {recs && recs.length === 0 && (
          <p className="text-xs text-[color:var(--muted)]">No suitable test found for that question and these variables.</p>
        )}
        {recs?.map((r, i) => (
          <div key={i} className="rounded-lg border border-[color:var(--border)] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-900">{r.testName}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CONFIDENCE_STYLE[r.confidence] ?? CONFIDENCE_STYLE.low}`}>
                {r.confidence} confidence
              </span>
            </div>

            {r.variables.length > 0 && (
              <div className="text-[11px] text-gray-700 space-y-0.5">
                {r.variables.map((v, j) => (
                  <div key={j} className="flex gap-1.5">
                    <span className="text-[color:var(--muted)]">{v.role}:</span>
                    <span className="font-mono">{v.column}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-gray-600 leading-relaxed">{r.rationale}</p>

            {r.assumptions.length > 0 && (
              <div className="text-[11px]">
                <span className="text-[color:var(--muted)] font-medium">Check: </span>
                <span className="text-gray-600">{r.assumptions.join("; ")}</span>
              </div>
            )}

            {r.alternatives && (
              <div className="text-[11px]">
                <span className="text-[color:var(--muted)] font-medium">If assumptions fail: </span>
                <span className="text-gray-600">{r.alternatives}</span>
              </div>
            )}

            <button
              onClick={() => {
                ws.dispatch({ type: "openDialog", key: r.analysisKey as DialogKey });
                onClose();
              }}
              className="btn btn-ghost text-[11px] flex items-center gap-1 text-indigo-700 hover:bg-indigo-50 border border-indigo-200"
            >
              Open this analysis <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
