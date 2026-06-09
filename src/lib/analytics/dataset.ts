/* Shared analytics dataset helpers. Used by:
 *  - /api/projects/[id]/analytics/dataset  (assembles the long-format payload)
 *  - /api/analytics/[...path]              (rebuilds the dataset server-side for the proxy)
 *  - /api/projects/[id]/export             (dedupes before CSV)
 */

import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySession = any;

export function dedupeSessions<T extends { takerEmail?: string | null; finishedAt?: Date | string | null; startedAt: Date | string; id: string }>(
  sessionsDesc: T[]
): T[] {
  const seen = new Set<string>();
  return sessionsDesc.filter((s) => {
    const stamp = s.finishedAt ?? s.startedAt;
    const bucket = stamp ? Math.floor(new Date(stamp).getTime() / 60000) : `id-${s.id}`;
    const key = `${(s.takerEmail ?? "").toLowerCase()}:${bucket}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type ColumnType = "numeric" | "categorical" | "ordinal";
export interface ColumnSchema {
  type: ColumnType;
  label: string;
}

const STATIC_SCHEMA: Record<string, ColumnSchema> = {
  session_id:   { type: "categorical", label: "Session ID" },
  pid:          { type: "categorical", label: "Participant ID" },
  email:        { type: "categorical", label: "Email" },
  stim_type:    { type: "categorical", label: "Stimulus type" },
  level:        { type: "ordinal",     label: "N-back level" },
  trial_index:  { type: "ordinal",     label: "Trial index" },
  rt_ms:        { type: "numeric",     label: "Reaction time (ms)" },
  correct:      { type: "categorical", label: "Correct" },
  is_priming:   { type: "categorical", label: "Priming trial" },
  tlx_mental:       { type: "numeric", label: "Mental demand" },
  tlx_physical:     { type: "numeric", label: "Physical demand" },
  tlx_temporal:     { type: "numeric", label: "Temporal demand" },
  tlx_performance:  { type: "numeric", label: "Performance" },
  tlx_effort:       { type: "numeric", label: "Effort" },
  tlx_frustration:  { type: "numeric", label: "Frustration" },
  tlx_paas:         { type: "numeric", label: "PAAS mental effort" },
  global_tlx_mental:       { type: "numeric", label: "Global mental demand" },
  global_tlx_physical:     { type: "numeric", label: "Global physical demand" },
  global_tlx_temporal:     { type: "numeric", label: "Global temporal demand" },
  global_tlx_performance:  { type: "numeric", label: "Global performance" },
  global_tlx_effort:       { type: "numeric", label: "Global effort" },
  global_tlx_frustration:  { type: "numeric", label: "Global frustration" },
  global_tlx_paas:         { type: "numeric", label: "Global PAAS effort" },
  age:          { type: "numeric",     label: "Age" },
  handedness:   { type: "categorical", label: "Handedness" },
  education:    { type: "categorical", label: "Education" },
};

interface BuildOpts {
  includeTrials?: boolean;
}

/** Columns that only exist on trial-level rows. If an analysis references none of
 *  these, the dataset can be built block-level (one row per block) — vastly smaller. */
export const TRIAL_COLUMNS = new Set(["trial_index", "is_priming", "rt_ms", "correct"]);

/**
 * Walks an analysis `variables` object and returns the subset of `available`
 * column names it references. Handles plain column refs, arrays of refs, and
 * free-text formula/model strings (tokenised on non-word chars, so
 * `"rt_ms ~ age + level"` yields `rt_ms`, `age`, `level`). Values that aren't
 * column names (e.g. "two-sided", "pearson") simply don't match and are ignored.
 */
export function referencedColumns(variables: unknown, available: Set<string>): Set<string> {
  const found = new Set<string>();
  const visit = (val: unknown) => {
    if (typeof val === "string") {
      if (available.has(val)) {
        found.add(val); // exact column name (covers custom_<uuid> whose hyphens break tokenisation)
      } else {
        for (const tok of val.split(/[^\w]+/)) { // formula/model strings: "rt_ms ~ age + level"
          if (tok && available.has(tok)) found.add(tok);
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach(visit);
    } else if (val && typeof val === "object") {
      Object.values(val).forEach(visit);
    }
  };
  visit(variables);
  return found;
}

export function buildLongDataset(
  sessions: AnySession[],
  customQuestions: { id: string; prompt: string }[],
  opts: BuildOpts = {}
): { rows: Record<string, unknown>[]; schema: Record<string, ColumnSchema> } {
  const includeTrials = opts.includeTrials ?? true;
  const rows: Record<string, unknown>[] = [];

  for (const s of sessions) {
    const g = (s.globalTLX ?? null) as Record<string, number> | null;
    const answers = (s.customAnswers ?? {}) as Record<string, string>;
    const base = {
      session_id: s.id,
      pid: s.participantId,
      email: s.takerEmail,
      age: s.takerAge ? Number(s.takerAge) : null,
      handedness: s.takerHandedness ?? null,
      education: s.takerEducation ?? null,
      global_tlx_mental: g?.mentalDemand ?? null,
      global_tlx_physical: g?.physicalDemand ?? null,
      global_tlx_temporal: g?.temporalDemand ?? null,
      global_tlx_performance: g?.performance ?? null,
      global_tlx_effort: g?.effort ?? null,
      global_tlx_frustration: g?.frustration ?? null,
      global_tlx_paas: g?.paasMentalEffort ?? null,
      ...Object.fromEntries(customQuestions.map((q) => [`custom_${q.id}`, answers[q.id] ?? null])),
    };

    for (const b of s.blocks ?? []) {
      const tlx = (b.perLevelTLX ?? null) as Record<string, number> | null;
      const blockBase = {
        ...base,
        stim_type: b.stimulusType,
        level: b.level,
        tlx_mental: tlx?.mentalDemand ?? null,
        tlx_physical: tlx?.physicalDemand ?? null,
        tlx_temporal: tlx?.temporalDemand ?? null,
        tlx_performance: tlx?.performance ?? null,
        tlx_effort: tlx?.effort ?? null,
        tlx_frustration: tlx?.frustration ?? null,
        tlx_paas: tlx?.paasMentalEffort ?? null,
      };

      if (includeTrials) {
        for (const t of b.trials ?? []) {
          rows.push({
            ...blockBase,
            trial_index: t.trialIndex,
            is_priming: t.isPriming,
            rt_ms: t.rtMs,
            correct: t.correct,
          });
        }
      } else {
        rows.push(blockBase);
      }
    }
  }

  const schema: Record<string, ColumnSchema> = { ...STATIC_SCHEMA };
  for (const q of customQuestions) {
    schema[`custom_${q.id}`] = { type: "categorical", label: q.prompt || q.id };
  }

  return { rows, schema };
}

/**
 * Loads a project's long-format analytics dataset directly from the database.
 * Server-side only. Shared by the dataset GET route and the analytics proxy so
 * the browser never has to upload the (potentially huge) row set.
 *
 * Returns `null` when the project does not exist.
 */
export async function loadProjectDataset(
  projectId: string,
  opts: BuildOpts = {}
): Promise<{ rows: Record<string, unknown>[]; schema: Record<string, ColumnSchema> } | null> {
  const includeTrials = opts.includeTrials ?? true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { config: true },
  });
  if (!project) return null;

  const sessionsRaw = await db.testSession.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      blocks: {
        orderBy: { blockIndex: "asc" },
        include: includeTrials
          ? { trials: { orderBy: { trialIndex: "asc" } } }
          : undefined,
      },
    },
  });

  const sessions = dedupeSessions(sessionsRaw as AnySession[]).reverse();

  const customQuestions: { id: string; prompt: string }[] = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((project.config as any)?.customQuestions ?? []) as any[]
  ).map((q) => ({ id: String(q.id), prompt: String(q.prompt ?? q.id) }));

  return buildLongDataset(sessions, customQuestions, { includeTrials });
}
