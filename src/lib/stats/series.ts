import { summarize, BlockMetrics } from "@/lib/scoring";
import { StimulusType, Level, CustomQuestion, TLXResponse, Trial } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawSession = any;

export type BlockMetricKey = keyof Pick<BlockMetrics,
  "accuracy" | "dPrime" | "rtMean" | "rtMedian" | "rtSD" | "hits" | "misses" | "falseAlarms" | "correctRejections" | "hitRate" | "faRate">;

export type TLXKey = keyof TLXResponse;

export type Variable =
  | { kind: "block-metric"; metric: BlockMetricKey; stimulusType?: StimulusType; level?: Level }
  | { kind: "tlx"; scope: "global" | "perLevel"; dim: TLXKey; level?: Level; stimulusType?: StimulusType }
  | { kind: "demographic"; field: "age" | "gender" | "handedness" | "education" | string }
  | { kind: "custom"; questionId: string }
  | { kind: "ref"; id: string };  // workspace-aware reference to a VariableDef

export interface VariableCatalog {
  blockMetrics: { key: BlockMetricKey; label: string }[];
  tlxDims: { key: TLXKey; label: string }[];
  demographics: { field: string; label: string; numeric: boolean }[];
  customQuestions: { id: string; prompt: string; type: CustomQuestion["type"]; numeric: boolean }[];
  stimulusTypes: StimulusType[];
  levels: Level[];
}

export const BLOCK_METRIC_LABELS: Record<BlockMetricKey, string> = {
  accuracy: "Accuracy", dPrime: "d′ (sensitivity)", rtMean: "RT mean (ms)",
  rtMedian: "RT median (ms)", rtSD: "RT SD (ms)", hits: "Hits", misses: "Misses",
  falseAlarms: "False alarms", correctRejections: "Correct rejections",
  hitRate: "Hit rate", faRate: "False-alarm rate",
};

export const TLX_LABELS: Record<TLXKey, string> = {
  mentalDemand: "Mental demand", physicalDemand: "Physical demand",
  temporalDemand: "Temporal demand", performance: "Performance",
  effort: "Effort", frustration: "Frustration", paasMentalEffort: "Paas (1–9)",
};

export interface NumericRow { participantId: string; value: number; sessionId?: string; }
export interface CategoricalRow { participantId: string; value: string; sessionId?: string; }

/** Extract a numeric value per participant/session, collapsing blocks by mean when no filter is set. */
export function extractNumeric(sessions: RawSession[], v: Variable, questions: CustomQuestion[] = []): NumericRow[] {
  const out: NumericRow[] = [];
  for (const s of sessions) {
    const val = numericFromSession(s, v, questions);
    if (val != null && isFinite(val)) {
      out.push({ participantId: s.participantId ?? s.takerEmail ?? s.id, sessionId: s.id, value: val });
    }
  }
  return out;
}

export function extractCategorical(sessions: RawSession[], v: Variable, questions: CustomQuestion[] = []): CategoricalRow[] {
  const out: CategoricalRow[] = [];
  for (const s of sessions) {
    const val = categoricalFromSession(s, v, questions);
    if (val != null && val !== "") {
      out.push({ participantId: s.participantId ?? s.takerEmail ?? s.id, sessionId: s.id, value: String(val) });
    }
  }
  return out;
}

function numericFromSession(s: RawSession, v: Variable, questions: CustomQuestion[]): number | null {
  if (v.kind === "ref") return null;  // resolved by workspace
  if (v.kind === "block-metric") {
    const blocks = (s.blocks ?? []).filter((b: { stimulusType: string; level: number }) =>
      (v.stimulusType == null || b.stimulusType === v.stimulusType) &&
      (v.level == null || b.level === v.level));
    if (blocks.length === 0) return null;
    const vals: number[] = [];
    for (const b of blocks) {
      const m = summarize((b.trials ?? []) as Trial[]);
      const val = m[v.metric];
      if (val != null && isFinite(val)) vals.push(val);
    }
    if (vals.length === 0) return null;
    return vals.reduce((a, c) => a + c, 0) / vals.length;
  }
  if (v.kind === "tlx") {
    if (v.scope === "global") {
      const t = s.globalTLX as TLXResponse | undefined;
      return t ? (t[v.dim] as number) ?? null : null;
    } else {
      const blocks = (s.blocks ?? []).filter((b: { stimulusType: string; level: number; perLevelTLX: TLXResponse | null }) =>
        (v.stimulusType == null || b.stimulusType === v.stimulusType) &&
        (v.level == null || b.level === v.level));
      const vals: number[] = [];
      for (const b of blocks) if (b.perLevelTLX) vals.push(b.perLevelTLX[v.dim]);
      if (!vals.length) return null;
      return vals.reduce((a, c) => a + c, 0) / vals.length;
    }
  }
  if (v.kind === "demographic") {
    const raw = readDemographic(s, v.field);
    if (raw == null) return null;
    const n = parseFloat(String(raw));
    return isFinite(n) ? n : null;
  }
  if (v.kind === "custom") {
    const raw = s.customAnswers?.[v.questionId];
    if (raw == null || raw === "") return null;
    const q = questions.find((qq) => qq.id === v.questionId);
    if (q?.type === "likert") {
      const n = parseInt(raw, 10);
      return isFinite(n) ? n : null;
    }
    if (q?.type === "mcq-alpha" || q?.type === "mcq-roman") {
      // Stored as "a. Option" — extract letter index
      const m = String(raw).match(/^([a-z]+|[ivx]+)\./i);
      if (!m) return null;
      const label = m[1].toLowerCase();
      if (q.type === "mcq-alpha") return label.charCodeAt(0) - 97;
      const roman = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
      const idx = roman.indexOf(label);
      return idx >= 0 ? idx : null;
    }
    const n = parseFloat(String(raw));
    return isFinite(n) ? n : null;
  }
  return null;
}

function categoricalFromSession(s: RawSession, v: Variable, questions: CustomQuestion[]): string | null {
  if (v.kind === "ref") return null;  // resolved by workspace
  if (v.kind === "demographic") return readDemographic(s, v.field);
  if (v.kind === "custom") {
    const raw = s.customAnswers?.[v.questionId];
    return raw != null ? String(raw) : null;
  }
  // Block-metric / TLX can be turned into category by binning — skip for now
  const num = numericFromSession(s, v, questions);
  return num != null ? String(num) : null;
}

function readDemographic(s: RawSession, field: string): string | null {
  const top = ["age", "gender", "handedness", "education"];
  if (top.includes(field)) {
    const key = "taker" + field.charAt(0).toUpperCase() + field.slice(1);
    const v = s[key];
    return v != null && v !== "" ? String(v) : null;
  }
  const extras = s.demographics?.extras ?? s.demographics ?? {};
  const v = extras?.[field];
  return v != null && v !== "" ? String(v) : null;
}

export function buildCatalog(sessions: RawSession[], questions: CustomQuestion[]): VariableCatalog {
  const stim = new Set<StimulusType>();
  const levels = new Set<Level>();
  for (const s of sessions) {
    for (const b of s.blocks ?? []) {
      stim.add(b.stimulusType);
      levels.add(b.level);
    }
  }
  return {
    blockMetrics: (Object.keys(BLOCK_METRIC_LABELS) as BlockMetricKey[]).map((k) => ({ key: k, label: BLOCK_METRIC_LABELS[k] })),
    tlxDims: (Object.keys(TLX_LABELS) as TLXKey[]).map((k) => ({ key: k, label: TLX_LABELS[k] })),
    demographics: [
      { field: "age", label: "Age", numeric: true },
      { field: "gender", label: "Gender", numeric: false },
      { field: "handedness", label: "Handedness", numeric: false },
      { field: "education", label: "Education", numeric: false },
    ],
    customQuestions: questions.map((q) => ({
      id: q.id, prompt: q.prompt || "(no prompt)", type: q.type,
      numeric: q.type === "likert" || q.type === "mcq-alpha" || q.type === "mcq-roman",
    })),
    stimulusTypes: [...stim],
    levels: [...levels].sort() as Level[],
  };
}

export function variableLabel(v: Variable, questions: CustomQuestion[] = [], labelOf?: (id: string) => string): string {
  if (v.kind === "ref") return labelOf ? labelOf(v.id) : v.id;
  if (v.kind === "block-metric") {
    const stim = v.stimulusType ? ` · ${v.stimulusType.replace("-", " ")}` : "";
    const lvl = v.level != null ? ` · ${v.level}-back` : "";
    return `${BLOCK_METRIC_LABELS[v.metric]}${stim}${lvl}`;
  }
  if (v.kind === "tlx") {
    const scope = v.scope === "global" ? "global" : "per-level";
    const stim = v.stimulusType ? ` · ${v.stimulusType.replace("-", " ")}` : "";
    const lvl = v.level != null ? ` · ${v.level}-back` : "";
    return `TLX ${TLX_LABELS[v.dim]} (${scope})${stim}${lvl}`;
  }
  if (v.kind === "demographic") return `Demographic: ${v.field}`;
  if (v.kind === "custom") {
    const q = questions.find((qq) => qq.id === v.questionId);
    return `Q: ${q?.prompt ?? v.questionId}`;
  }
  return "";
}

export function joinByParticipant(a: NumericRow[], b: NumericRow[]): { a: number[]; b: number[] } {
  const map = new Map<string, number>();
  for (const r of a) map.set(r.participantId, r.value);
  const outA: number[] = [], outB: number[] = [];
  for (const r of b) {
    const av = map.get(r.participantId);
    if (av != null) { outA.push(av); outB.push(r.value); }
  }
  return { a: outA, b: outB };
}

export function groupByCategory(
  values: NumericRow[], groups: CategoricalRow[]
): { name: string; values: number[] }[] {
  const gmap = new Map<string, string>();
  for (const g of groups) gmap.set(g.participantId, g.value);
  const buckets = new Map<string, number[]>();
  for (const v of values) {
    const g = gmap.get(v.participantId);
    if (g == null) continue;
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g)!.push(v.value);
  }
  return [...buckets.entries()].map(([name, vs]) => ({ name, values: vs })).sort((a, b) => a.name.localeCompare(b.name));
}
