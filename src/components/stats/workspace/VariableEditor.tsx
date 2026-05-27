"use client";
import { useState, useEffect } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { VariableDef } from "@/lib/stats";
import { X, Trash2 } from "lucide-react";

export function VariableEditor({ variableId, onClose }: { variableId: string; onClose: () => void }) {
  const ws = useWorkspace();
  const def = ws.variables.find((v) => v.id === variableId);
  const [label, setLabel] = useState(def?.label ?? "");
  const [role, setRole] = useState<VariableDef["role"]>(def?.role ?? "numeric");
  useEffect(() => { if (def) { setLabel(def.label); setRole(def.role); } }, [def]);

  if (!def) return null;
  const numericRows = ws.getNumericRows(variableId);
  const catRows = ws.getCategoricalRows(variableId);
  const isDerived = def.source.kind === "derived";

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Variable details</h3>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="label text-xs">Label</span>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)}
              onBlur={() => ws.dispatch({ type: "renameVar", id: variableId, label })} />
          </label>
          <label className="block">
            <span className="label text-xs">Role</span>
            <select className="select" value={role}
              onChange={(e) => {
                const r = e.target.value as VariableDef["role"];
                setRole(r);
                ws.dispatch({ type: "setRole", id: variableId, role: r });
              }}>
              <option value="numeric">Numeric (scale)</option>
              <option value="ordinal">Ordinal</option>
              <option value="nominal">Nominal</option>
            </select>
          </label>
          <div className="text-xs text-[color:var(--muted)]">
            <div>Source: <strong>{isDerived ? "derived" : "native"}</strong></div>
            <div>Non-missing values: <strong>{numericRows.length || catRows.length}</strong></div>
            {numericRows.length > 0 && (
              <div className="mt-1">
                Range: <span className="font-mono">{Math.min(...numericRows.map((r) => r.value)).toFixed(2)} … {Math.max(...numericRows.map((r) => r.value)).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
        {isDerived && (
          <div className="mt-4 pt-4 border-t border-[color:var(--border)] flex justify-end">
            <button
              onClick={() => { ws.dispatch({ type: "removeVar", id: variableId }); onClose(); }}
              className="btn btn-ghost text-xs text-[color:var(--danger)] flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Delete derived variable
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
