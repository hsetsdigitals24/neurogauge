"use client";
import { useState, useMemo } from "react";
import {
  Variable, VariableCatalog, roc,
  fmt, variableLabel, type RocResult,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker, CategoricalPicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { ROCPlot } from "../ROCPlot";
import { useExtract } from "../workspace/WorkspaceProvider";

export function RocCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [score, setScore] = useState<Variable | null>(null);
  const [outcome, setOutcome] = useState<Variable | null>(null);
  const [positiveValue, setPositiveValue] = useState("");

  type Res = { error: string; uniq?: string[] } | { res: RocResult; uniq: string[]; pos: string };
  const result = useMemo<Res | null>(() => {
    if (!score || !outcome) return null;
    const rawY = extractCategorical(sessions, outcome, questions);
    const uniq = Array.from(new Set(rawY.map((r) => r.value))).sort();
    if (uniq.length < 2) return { error: "Outcome must have ≥2 categories.", uniq };
    const pos = positiveValue || uniq[uniq.length - 1];
    const yMap = new Map(rawY.map((r) => [r.participantId, r.value === pos ? 1 : 0]));
    const scoreData = extractNumeric(sessions, score, questions);
    const labels: number[] = [], scores: number[] = [];
    for (const s of scoreData) {
      const y = yMap.get(s.participantId);
      if (y != null) { labels.push(y); scores.push(s.value); }
    }
    if (labels.length < 5) return { error: "Need ≥5 paired observations." };
    return { res: roc(labels, scores), uniq, pos };
  }, [score, outcome, positiveValue, sessions, questions]);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <VariablePicker catalog={catalog} value={score} onChange={setScore} label="Score / predictor (numeric)" />
        <CategoricalPicker catalog={catalog} value={outcome} onChange={setOutcome} label="Outcome (categorical)" />
      </div>
      {result && "uniq" in result && result.uniq && (
        <label className="block">
          <span className="label text-xs">Positive class</span>
          <select className="select" value={positiveValue} onChange={(e) => setPositiveValue(e.target.value)}>
            <option value="">(auto)</option>
            {result.uniq.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {result && "error" in result && result.error && <p className="text-sm text-[color:var(--danger)]">{result.error}</p>}
      {result && "res" in result && (
        <>
          <p className="text-sm font-semibold">
            {score && variableLabel(score, questions)} predicts {outcome && variableLabel(outcome, questions)} = {result.pos}
          </p>
          <div className="grid md:grid-cols-2 gap-4 items-start">
            <StatTable rows={[
              { label: "AUC", value: fmt(result.res.auc, 4) },
              { label: "n", value: result.res.n },
              { label: "Positives / Negatives", value: `${result.res.positives} / ${result.res.negatives}` },
              { label: "Optimal threshold (Youden)", value: fmt(result.res.optimal.threshold, 3) },
              { label: "Sensitivity @ optimal", value: fmt(result.res.optimal.sensitivity, 3) },
              { label: "Specificity @ optimal", value: fmt(result.res.optimal.specificity, 3) },
              { label: "Youden's J", value: fmt(result.res.optimal.youden, 3) },
            ]} />
            <ROCPlot points={result.res.points} auc={result.res.auc} />
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload filename="roc.csv" rows={[
              ["auc", result.res.auc], ["n", result.res.n],
              ["positives", result.res.positives], ["negatives", result.res.negatives],
              ["optimal_threshold", result.res.optimal.threshold],
              ["optimal_sensitivity", result.res.optimal.sensitivity],
              ["optimal_specificity", result.res.optimal.specificity],
              ["threshold", "tpr", "fpr"],
              ...result.res.points.map((p) => [p.threshold, p.tpr, p.fpr]),
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
