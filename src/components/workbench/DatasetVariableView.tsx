"use client";
import { useState } from "react";
import { Plus, Trash2, Sigma } from "lucide-react";
import { useWorkbench } from "@/contexts/WorkbenchContext";
import type { ColumnType } from "@/lib/analytics/dataset";

/**
 * Schema-driven Variable View for uploaded datasets. Lets the user retype and
 * rename each column (driving which analyses offer it) and manage computed
 * columns. Edits flow into the workbench `state.schema`, which `colOptions`
 * filters — and are persisted by WorkbenchShell (PATCH /api/datasets/[id]).
 */
export function DatasetVariableView({ onNewComputed }: { onNewComputed: () => void }) {
  const { state, dispatch, filteredRows } = useWorkbench();
  const computedKeys = new Set(state.computedColumns.map((c) => c.key));
  const columns = Object.keys(state.schema);

  function nonNull(col: string): number {
    let n = 0;
    for (const r of filteredRows) if (r[col] != null && r[col] !== "") n++;
    return n;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[color:var(--muted)]">
          {columns.length} variables · edit type or label, or add a computed column
        </p>
        <button className="btn btn-primary text-xs flex items-center gap-1" onClick={onNewComputed}>
          <Sigma className="w-3.5 h-3.5" /> New computed column
        </button>
      </div>

      <table className="w-full text-xs">
        <thead className="text-left text-[color:var(--muted)] sticky top-0 bg-white">
          <tr>
            <th className="py-2 pr-3">Label</th>
            <th className="pr-3">Type</th>
            <th className="pr-3">Key</th>
            <th className="pr-3">Non-missing</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => (
            <VariableRow
              key={col}
              col={col}
              label={state.schema[col].label}
              type={state.schema[col].type}
              isComputed={computedKeys.has(col)}
              nonNull={nonNull(col)}
              onRename={(label) => dispatch({ type: "renameColumn", col, label })}
              onRetype={(columnType) => dispatch({ type: "setColumnType", col, columnType })}
              onRemove={() => dispatch({ type: "removeComputedColumn", key: col })}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VariableRow({
  col, label, type, isComputed, nonNull, onRename, onRetype, onRemove,
}: {
  col: string;
  label: string;
  type: ColumnType;
  isComputed: boolean;
  nonNull: number;
  onRename: (label: string) => void;
  onRetype: (t: ColumnType) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(label);

  return (
    <tr className="border-t border-[color:var(--border)] hover:bg-gray-50">
      <td className="py-1.5 pr-3">
        <input
          className="input text-xs py-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (draft !== label) onRename(draft.trim() || col); }}
        />
      </td>
      <td className="pr-3">
        <select
          className="select text-xs py-1"
          value={type}
          onChange={(e) => onRetype(e.target.value as ColumnType)}
        >
          <option value="numeric">Numeric</option>
          <option value="categorical">Categorical</option>
          <option value="ordinal">Ordinal</option>
        </select>
      </td>
      <td className="pr-3 font-mono text-[10px] text-[color:var(--muted)]">
        {col}
        {isComputed && (
          <span className="ml-1.5 px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 inline-flex items-center gap-0.5">
            <Plus className="w-2.5 h-2.5" /> computed
          </span>
        )}
      </td>
      <td className="pr-3 font-mono">{nonNull}</td>
      <td>
        {isComputed && (
          <button
            className="btn btn-ghost p-1 text-[color:var(--danger)]"
            title="Delete computed column"
            onClick={onRemove}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}
