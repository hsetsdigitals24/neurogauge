/* Client + server helpers for questionnaire projects. */
import { generateId } from "@/lib/id";
import { sanitiseColumnKey, uniqueKey } from "@/lib/analytics/csvIngest";
import type { QItem, QuestionType } from "@/lib/types";

/** A fresh, empty question of the given type. */
export function blankQuestion(type: QuestionType = "likert"): QItem {
  const q: QItem = { id: generateId(), key: "", prompt: "", type };
  if (type === "likert") q.scalePoints = 5;
  if (type === "single" || type === "multi") q.options = ["", ""];
  return q;
}

/**
 * Assign each question a unique, analysis-safe column `key` derived from its
 * prompt. Question `id`s are stable (responses are keyed by id), so keys can be
 * recomputed freely without breaking existing response linkage.
 */
export function normalizeQuestionKeys(items: QItem[]): QItem[] {
  const used = new Set<string>();
  return items.map((q, i) => {
    const base = sanitiseColumnKey(q.prompt || `q_${i + 1}`, `q_${i + 1}`).slice(0, 40) || `q_${i + 1}`;
    const key = uniqueKey(base, used);
    used.add(key);
    return { ...q, key };
  });
}
