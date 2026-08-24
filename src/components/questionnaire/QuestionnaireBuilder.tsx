"use client";
import { ChevronUp, ChevronDown, Trash2, Plus, GripVertical } from "lucide-react";
import { blankQuestion } from "@/lib/questionnaire";
import type { QItem, QuestionType } from "@/lib/types";

const TYPE_OPTIONS: { v: QuestionType; label: string }[] = [
  { v: "likert", label: "Likert scale" },
  { v: "single", label: "Single choice" },
  { v: "multi", label: "Multiple choice" },
  { v: "open", label: "Open-ended" },
  { v: "numeric", label: "Number" },
];

/**
 * Editable question list for a questionnaire project. Controlled: the parent
 * owns the QItem[]. Reused by the new-project AI form and the project config tab.
 */
export default function QuestionnaireBuilder({
  questions,
  onChange,
}: {
  questions: QItem[];
  onChange: (q: QItem[]) => void;
}) {
  function patch(id: string, p: Partial<QItem>) {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...p } : q)));
  }
  function remove(id: string) {
    onChange(questions.filter((q) => q.id !== id));
  }
  function move(idx: number, dir: -1 | 1) {
    const next = [...questions];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  }
  function add() {
    onChange([...questions, blankQuestion("likert")]);
  }
  function changeType(id: string, type: QuestionType) {
    const p: Partial<QItem> = { type };
    const q = questions.find((x) => x.id === id);
    if ((type === "single" || type === "multi") && (!q?.options || q.options.length === 0)) {
      p.options = ["", ""];
    }
    if (type === "likert" && !q?.scalePoints) p.scalePoints = 5;
    patch(id, p);
  }

  return (
    <div className="space-y-4">
      {questions.length === 0 && (
        <p className="text-sm text-[color:var(--muted)]">
          No questions yet. Add one below, or generate a draft with AI.
        </p>
      )}

      {questions.map((q, i) => (
        <div key={q.id} className="border border-[color:var(--border)] rounded-xl p-4">
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center pt-2 text-[color:var(--muted)]">
              <GripVertical className="w-4 h-4" />
              <span className="text-[11px] font-bold">{i + 1}</span>
            </div>

            <div className="flex-1 space-y-3">
              <input
                className="input"
                placeholder="Question prompt"
                value={q.prompt}
                onChange={(e) => patch(q.id, { prompt: e.target.value })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select
                    className="select mt-1"
                    value={q.type}
                    onChange={(e) => changeType(q.id, e.target.value as QuestionType)}
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.v} value={t.v}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {q.type === "likert" && (
                  <div>
                    <label className="label">Scale points</label>
                    <select
                      className="select mt-1"
                      value={q.scalePoints ?? 5}
                      onChange={(e) => patch(q.id, { scalePoints: parseInt(e.target.value) })}
                    >
                      {[3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>{n}-point</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {(q.type === "single" || q.type === "multi") && (
                <div>
                  <label className="label">Answer options (one per line)</label>
                  <textarea
                    className="textarea mt-1"
                    rows={3}
                    placeholder={"Option A\nOption B\nOption C"}
                    value={(q.options ?? []).join("\n")}
                    onChange={(e) => patch(q.id, { options: e.target.value.split("\n") })}
                  />
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={q.required ?? false}
                    onChange={(e) => patch(q.id, { required: e.target.checked })}
                  />
                  Required
                </label>
                <div className="flex items-center gap-1">
                  <button type="button" className="btn btn-ghost p-2" title="Move up"
                    onClick={() => move(i, -1)} disabled={i === 0}>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button type="button" className="btn btn-ghost p-2" title="Move down"
                    onClick={() => move(i, 1)} disabled={i === questions.length - 1}>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button type="button" className="btn btn-ghost p-2 text-[color:var(--danger)]" title="Delete"
                    onClick={() => remove(q.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-ghost flex items-center gap-2" onClick={add}>
        <Plus className="w-4 h-4" /> Add question
      </button>
    </div>
  );
}
