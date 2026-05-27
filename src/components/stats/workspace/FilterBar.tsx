"use client";
import { useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { Filter, Plus, X } from "lucide-react";
import { FilterOp } from "@/lib/stats";
import { useWorkbenchOptional } from "@/contexts/WorkbenchContext";

const OPS: FilterOp[] = ["==", "!=", "<", "<=", ">", ">="];

const STIM_LABELS: Record<string, string> = {
  "letters": "Letters",
  "shapes": "Shapes",
  "rotated-e": "Rotated E",
};

export function FilterBar() {
  const ws = useWorkspace();
  const wb = useWorkbenchOptional();
  const [adding, setAdding] = useState(false);
  const [variableId, setVariableId] = useState(ws.variables[0]?.id ?? "");
  const [op, setOp] = useState<FilterOp>(">");
  const [value, setValue] = useState("");

  function addClause() {
    if (!variableId || value === "") return;
    const num = parseFloat(value);
    ws.dispatch({ type: "addFilter", clause: { variableId, op, value: isFinite(num) ? num : value } });
    setValue(""); setAdding(false);
  }

  const totalPids = ws.visibleParticipants ? ws.visibleParticipants.size : null;

  return (
    <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-[color:var(--border)] bg-gray-50">
      <Filter className="w-3.5 h-3.5 text-[color:var(--muted)]" />
      <span className="text-xs font-semibold text-[color:var(--muted)]">Filter:</span>
      {/* N-back filter chip from workbench context */}
      {wb?.state.nbackFilter && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100 inline-flex items-center gap-1">
          <span>
            {wb.state.nbackFilter.stimType ? STIM_LABELS[wb.state.nbackFilter.stimType] ?? wb.state.nbackFilter.stimType : "All"}
            {wb.state.nbackFilter.level !== null ? ` · ${wb.state.nbackFilter.level}-back` : ""}
          </span>
          <button onClick={() => wb.dispatch({ type: "setNBackFilter", filter: null })} className="hover:text-cyan-900">
            <X className="w-3 h-3" />
          </button>
        </span>
      )}
      {ws.state.filter.clauses.length === 0 && !wb?.state.nbackFilter && (
        <span className="text-xs text-[color:var(--muted)]">(no filter — all participants)</span>
      )}
      {ws.state.filter.clauses.map((c, i) => (
        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1">
          <span>{ws.labelOf(c.variableId)} {c.op} {String(c.value)}</span>
          <button onClick={() => ws.dispatch({ type: "removeFilter", index: i })} className="hover:text-indigo-900">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {!adding ? (
        <button className="btn btn-ghost text-xs flex items-center gap-1 py-0.5"
          onClick={() => setAdding(true)}>
          <Plus className="w-3 h-3" /> Add clause
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">
          <select className="select py-0.5 text-xs" value={variableId} onChange={(e) => setVariableId(e.target.value)}>
            {ws.variables.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <select className="select py-0.5 text-xs w-16" value={op} onChange={(e) => setOp(e.target.value as FilterOp)}>
            {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input className="input py-0.5 text-xs w-20" value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addClause()} autoFocus />
          <button className="btn btn-primary text-xs py-0.5" onClick={addClause}>Add</button>
          <button className="btn btn-ghost text-xs py-0.5" onClick={() => setAdding(false)}>Cancel</button>
        </span>
      )}
      <span className="ml-auto text-xs text-[color:var(--muted)]">
        {totalPids != null ? `${totalPids} participants pass` : `${ws.sessions.length} sessions`}
      </span>
    </div>
  );
}
