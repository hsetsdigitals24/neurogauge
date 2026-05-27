"use client";
import React, { createContext, useContext, useMemo, useReducer, useEffect, useCallback, useRef } from "react";
import {
  Variable, VariableCatalog, buildCatalog, extractNumeric, extractCategorical,
  WorkspaceState, VariableDef, FilterExpr, OutputEntry, DialogKey, Transform,
  computeDerived, filterPids, saveLocal, loadLocal,
  BLOCK_METRIC_LABELS, TLX_LABELS,
} from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";

// ============================================================================
// Reducer
// ============================================================================

type Action =
  | { type: "load"; state: WorkspaceState }
  | { type: "reset" }
  | { type: "renameVar"; id: string; label: string }
  | { type: "setRole"; id: string; role: VariableDef["role"] }
  | { type: "addDerived"; def: VariableDef }
  | { type: "removeVar"; id: string }
  | { type: "setFilter"; filter: FilterExpr }
  | { type: "addFilter"; clause: FilterExpr["clauses"][number] }
  | { type: "removeFilter"; index: number }
  | { type: "openDialog"; key: DialogKey | null }
  | { type: "setCenter"; tab: WorkspaceState["centerTab"] }
  | { type: "appendOutput"; entry: OutputEntry }
  | { type: "togglePin"; id: string }
  | { type: "removeOutput"; id: string }
  | { type: "clearOutputs" };

function reducer(s: WorkspaceState, a: Action): WorkspaceState {
  switch (a.type) {
    case "load": return a.state;
    case "reset": return { ...s, variables: s.variables.filter((v) => v.source.kind === "native"), filter: { clauses: [] }, outputs: [], activeDialog: null, centerTab: "data" };
    case "renameVar": return { ...s, variables: s.variables.map((v) => v.id === a.id ? { ...v, label: a.label } : v) };
    case "setRole": return { ...s, variables: s.variables.map((v) => v.id === a.id ? { ...v, role: a.role } : v) };
    case "addDerived": return { ...s, variables: [...s.variables, a.def] };
    case "removeVar": return { ...s, variables: s.variables.filter((v) => v.id !== a.id), filter: { clauses: s.filter.clauses.filter((c) => c.variableId !== a.id) } };
    case "setFilter": return { ...s, filter: a.filter };
    case "addFilter": return { ...s, filter: { clauses: [...s.filter.clauses, a.clause] } };
    case "removeFilter": return { ...s, filter: { clauses: s.filter.clauses.filter((_, i) => i !== a.index) } };
    case "openDialog": return { ...s, activeDialog: a.key, centerTab: a.key ? "dialog" : s.centerTab };
    case "setCenter": return { ...s, centerTab: a.tab };
    case "appendOutput": return { ...s, outputs: [a.entry, ...s.outputs] };
    case "togglePin": return { ...s, outputs: s.outputs.map((o) => o.id === a.id ? { ...o, pinned: !o.pinned } : o) };
    case "removeOutput": return { ...s, outputs: s.outputs.filter((o) => o.id !== a.id) };
    case "clearOutputs": return { ...s, outputs: [] };
    default: return s;
  }
}

// ============================================================================
// Initial seeding
// ============================================================================

function seedVariables(catalog: VariableCatalog): VariableDef[] {
  const out: VariableDef[] = [];
  // Block metrics — both "all blocks" and per-level
  for (const m of catalog.blockMetrics) {
    out.push({
      id: `bm.${m.key}`,
      label: m.label,
      role: "numeric",
      source: { kind: "native", variable: { kind: "block-metric", metric: m.key } as Variable },
    });
    for (const lvl of catalog.levels) {
      out.push({
        id: `bm.${m.key}.lvl${lvl}`,
        label: `${m.label} · ${lvl}-back`,
        role: "numeric",
        source: { kind: "native", variable: { kind: "block-metric", metric: m.key, level: lvl } as Variable },
      });
    }
  }
  // TLX
  for (const t of catalog.tlxDims) {
    out.push({
      id: `tlx.global.${t.key}`,
      label: `TLX ${t.label} (global)`,
      role: "numeric",
      source: { kind: "native", variable: { kind: "tlx", scope: "global", dim: t.key } as Variable },
    });
    for (const lvl of catalog.levels) {
      out.push({
        id: `tlx.lvl${lvl}.${t.key}`,
        label: `TLX ${t.label} · ${lvl}-back`,
        role: "numeric",
        source: { kind: "native", variable: { kind: "tlx", scope: "perLevel", dim: t.key, level: lvl } as Variable },
      });
    }
  }
  // Demographics
  for (const d of catalog.demographics) {
    out.push({
      id: `demo.${d.field}`,
      label: d.label,
      role: d.numeric ? "ordinal" : "nominal",
      source: { kind: "native", variable: { kind: "demographic", field: d.field } as Variable },
    });
  }
  // Custom questions
  for (const q of catalog.customQuestions) {
    out.push({
      id: `cust.${q.id}`,
      label: q.prompt,
      role: q.type === "likert" ? "ordinal" : q.numeric ? "numeric" : "nominal",
      source: { kind: "native", variable: { kind: "custom", questionId: q.id } as Variable },
    });
  }
  return out;
}

// ============================================================================
// Context
// ============================================================================

export interface WorkspaceAPI {
  projectId: string;
  state: WorkspaceState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[];
  questions: CustomQuestion[];
  catalog: VariableCatalog;
  variables: VariableDef[];                              // alias state.variables
  visibleParticipants: Set<string> | null;               // null = no filter
  resolveNumeric(variableId: string): Map<string, number | null>;
  resolveAny(variableId: string): Map<string, number | string | null>;
  getNumericRows(variableId: string): { participantId: string; value: number }[];
  getCategoricalRows(variableId: string): { participantId: string; value: string }[];
  labelOf(variableId: string): string;
  dispatch: React.Dispatch<Action>;
  // helpers
  addDerivedVariable(label: string, role: VariableDef["role"], transform: Transform): string;
  appendOutput(entry: Omit<OutputEntry, "id" | "timestamp" | "pinned">): void;
}

const Ctx = createContext<WorkspaceAPI | null>(null);

export function useWorkspace(): WorkspaceAPI {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be inside <WorkspaceProvider>");
  return v;
}

export function WorkspaceProvider({
  projectId, sessions, questions, children,
}: {
  projectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[];
  questions: CustomQuestion[];
  children: React.ReactNode;
}) {
  const catalog = useMemo(() => buildCatalog(sessions, questions), [sessions, questions]);

  const initial = useMemo<WorkspaceState>(() => {
    const seeded = seedVariables(catalog);
    return {
      projectId,
      variables: seeded,
      filter: { clauses: [] },
      activeDialog: null,
      outputs: [],
      centerTab: "data",
    };
  }, [projectId, catalog]);

  const [state, dispatch] = useReducer(reducer, initial);

  // Load from localStorage once on mount
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const stored = loadLocal(projectId);
    if (stored) {
      // merge: keep native variables seeded from current catalog (in case data changed),
      // but restore derived variables + filter + outputs from storage
      const native = initial.variables;
      const derived = stored.variables.filter((v) => v.source.kind === "derived");
      // also apply stored labels/roles to native vars where ids match
      const nativeMap = new Map(native.map((v) => [v.id, v]));
      for (const sv of stored.variables) {
        if (sv.source.kind === "native" && nativeMap.has(sv.id)) {
          const cur = nativeMap.get(sv.id)!;
          nativeMap.set(sv.id, { ...cur, label: sv.label, role: sv.role });
        }
      }
      dispatch({ type: "load", state: {
        projectId, centerTab: "data", activeDialog: null,
        variables: [...nativeMap.values(), ...derived],
        filter: stored.filter ?? { clauses: [] },
        outputs: stored.outputs ?? [],
      }});
    }
  }, [projectId, initial.variables]);

  // Auto-persist (debounced)
  useEffect(() => {
    const t = setTimeout(() => saveLocal(state), 500);
    return () => clearTimeout(t);
  }, [state]);

  // Memoised value resolution: cache numeric & categorical maps per variableId
  const numericCache = useRef(new Map<string, Map<string, number | null>>());
  const categoricalCache = useRef(new Map<string, Map<string, number | string | null>>());

  // Invalidate caches whenever sessions or variable definitions change
  useEffect(() => {
    numericCache.current = new Map();
    categoricalCache.current = new Map();
  }, [sessions, state.variables]);

  const resolveNumericInternal = useCallback((variableId: string): Map<string, number | null> => {
    const cached = numericCache.current.get(variableId);
    if (cached) return cached;
    const def = state.variables.find((v) => v.id === variableId);
    if (!def) return new Map();
    let result: Map<string, number | null>;
    if (def.source.kind === "native") {
      const rows = extractNumeric(sessions, def.source.variable, questions);
      result = new Map(rows.map((r) => [r.participantId, r.value as number | null]));
    } else {
      result = computeDerived(def, resolveNumericInternal, resolveAnyInternal);
    }
    numericCache.current.set(variableId, result);
    return result;
  }, [sessions, questions, state.variables]);

  const resolveAnyInternal = useCallback((variableId: string): Map<string, number | string | null> => {
    const cached = categoricalCache.current.get(variableId);
    if (cached) return cached;
    const def = state.variables.find((v) => v.id === variableId);
    if (!def) return new Map();
    let result: Map<string, number | string | null>;
    if (def.source.kind === "native") {
      const rows = extractCategorical(sessions, def.source.variable, questions);
      result = new Map(rows.map((r) => [r.participantId, r.value]));
    } else {
      // for derived, fall back to numeric
      const num = resolveNumericInternal(variableId);
      result = new Map([...num.entries()]);
    }
    categoricalCache.current.set(variableId, result);
    return result;
  }, [sessions, questions, state.variables, resolveNumericInternal]);

  const visiblePids = useMemo(() => filterPids(state.filter, resolveAnyInternal, state.variables),
    [state.filter, state.variables, resolveAnyInternal]);

  const labelOf = useCallback((id: string) => state.variables.find((v) => v.id === id)?.label ?? id,
    [state.variables]);

  const getNumericRows = useCallback((variableId: string) => {
    const m = resolveNumericInternal(variableId);
    const out: { participantId: string; value: number }[] = [];
    for (const [pid, v] of m) {
      if (v == null || !isFinite(v)) continue;
      if (visiblePids && !visiblePids.has(pid)) continue;
      out.push({ participantId: pid, value: v });
    }
    return out;
  }, [resolveNumericInternal, visiblePids]);

  const getCategoricalRows = useCallback((variableId: string) => {
    const m = resolveAnyInternal(variableId);
    const out: { participantId: string; value: string }[] = [];
    for (const [pid, v] of m) {
      if (v == null) continue;
      if (visiblePids && !visiblePids.has(pid)) continue;
      out.push({ participantId: pid, value: String(v) });
    }
    return out;
  }, [resolveAnyInternal, visiblePids]);

  const addDerivedVariable = useCallback((label: string, role: VariableDef["role"], transform: Transform) => {
    const id = `derived.${Math.random().toString(36).slice(2, 10)}`;
    dispatch({ type: "addDerived", def: { id, label, role, source: { kind: "derived", transform } } });
    return id;
  }, []);

  const appendOutput = useCallback((entry: Omit<OutputEntry, "id" | "timestamp" | "pinned">) => {
    dispatch({ type: "appendOutput", entry: {
      ...entry,
      id: `out.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      pinned: false,
    }});
  }, []);

  const api: WorkspaceAPI = {
    projectId: state.projectId,
    state, sessions, questions, catalog,
    variables: state.variables,
    visibleParticipants: visiblePids,
    resolveNumeric: resolveNumericInternal,
    resolveAny: resolveAnyInternal,
    getNumericRows, getCategoricalRows,
    labelOf, dispatch, addDerivedVariable, appendOutput,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

// Re-export label sources for convenience
export { BLOCK_METRIC_LABELS, TLX_LABELS };

// ============================================================================
// useExtract hook: workspace-aware extractNumeric / extractCategorical
// Resolves `kind: "ref"` variables through the workspace.
// ============================================================================

export function useExtract() {
  const ws = useWorkspace();
  function extractNumericW(_sessions: unknown, v: Variable, _questions?: unknown) {
    if (v.kind === "ref") return ws.getNumericRows(v.id);
    return extractNumeric(ws.sessions, v, ws.questions);
  }
  function extractCategoricalW(_sessions: unknown, v: Variable, _questions?: unknown) {
    if (v.kind === "ref") return ws.getCategoricalRows(v.id);
    return extractCategorical(ws.sessions, v, ws.questions);
  }
  return { extractNumeric: extractNumericW, extractCategorical: extractCategoricalW, labelOf: ws.labelOf };
}
