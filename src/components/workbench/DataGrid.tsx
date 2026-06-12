"use client";
import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, Columns3, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useWorkbench } from "@/contexts/WorkbenchContext";
import type { ColumnSchema, ColumnType } from "@/lib/analytics/dataset";
import { sanitiseColumnKey, uniqueKey } from "@/lib/analytics/csvIngest";

const STIM_COLORS: Record<string, string> = {
  "letters":   "border-l-2 border-l-cyan-400",
  "shapes":    "border-l-2 border-l-purple-400",
  "rotated-e": "border-l-2 border-l-amber-400",
};

function cellClass(schema: ColumnSchema | undefined): string {
  return schema?.type === "numeric"
    ? "text-right font-mono tabular-nums"
    : "text-left";
}

function formatCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

interface ColumnPickerProps {
  allColumns: string[];
  visibleColumns: string[];
  schema: Record<string, ColumnSchema>;
  onToggle: (col: string) => void;
  onClose: () => void;
}

function ColumnPicker({ allColumns, visibleColumns, schema, onToggle, onClose }: ColumnPickerProps) {
  const visible = new Set(visibleColumns);
  return (
    <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-[color:var(--border)] rounded-xl shadow-xl p-3 w-64 max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold">Visible columns</span>
        <button className="text-xs text-[color:var(--muted)] hover:text-gray-700" onClick={onClose}>Done</button>
      </div>
      <div className="space-y-1">
        {allColumns.map((col) => (
          <label key={col} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
            <input
              type="checkbox"
              checked={visible.has(col)}
              onChange={() => onToggle(col)}
              className="accent-indigo-600"
            />
            <span className="flex-1 truncate">{schema[col]?.label ?? col}</span>
            <span className="text-[10px] text-[color:var(--muted)]">{schema[col]?.type ?? ""}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

interface AddColumnPopoverProps {
  schema: Record<string, ColumnSchema>;
  onAdd: (key: string, label: string, columnType: ColumnType) => void;
  onClose: () => void;
}

function AddColumnPopover({ schema, onAdd, onClose }: AddColumnPopoverProps) {
  const [label, setLabel] = useState("");
  const [columnType, setColumnType] = useState<ColumnType>("numeric");

  function submit() {
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = uniqueKey(sanitiseColumnKey(trimmed), new Set(Object.keys(schema)));
    onAdd(key, trimmed, columnType);
    onClose();
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-[color:var(--border)] rounded-xl shadow-xl p-3 w-60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold">New column</span>
        <button className="text-xs text-[color:var(--muted)] hover:text-gray-700" onClick={onClose}>Cancel</button>
      </div>
      <input
        autoFocus
        className="input text-xs w-full mb-2"
        placeholder="Column name"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
      />
      <select
        className="select text-xs w-full mb-2"
        value={columnType}
        onChange={(e) => setColumnType(e.target.value as ColumnType)}
      >
        <option value="numeric">numeric</option>
        <option value="categorical">categorical</option>
        <option value="ordinal">ordinal</option>
      </select>
      <button className="btn btn-primary text-xs w-full" disabled={!label.trim()} onClick={submit}>
        Add column
      </button>
    </div>
  );
}

interface EditingCell {
  rowRef: Record<string, unknown>;
  col: string;
}

export function DataGrid() {
  const { state, dispatch, filteredRows, source } = useWorkbench();
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [draft, setDraft] = useState("");

  // Direct editing is only for uploaded datasets — project rows are rebuilt
  // from session data on every load, so edits there could never persist.
  const editable = source.kind === "dataset";

  function startEdit(rowRef: Record<string, unknown>, col: string) {
    if (!editable) return;
    setEditing({ rowRef, col });
    const v = rowRef[col];
    setDraft(v == null ? "" : String(v));
  }

  function commitEdit() {
    if (!editing) return;
    dispatch({ type: "editCell", rowRef: editing.rowRef, col: editing.col, value: draft });
    setEditing(null);
  }

  const visibleCols = useMemo(
    () => state.visibleColumns.filter((c) => c in state.schema),
    [state.visibleColumns, state.schema]
  );

  const allCols = useMemo(() => Object.keys(state.schema), [state.schema]);

  const sortedRows = useMemo(() => {
    if (!state.sortCol) return filteredRows;
    const col = state.sortCol;
    const dir = state.sortDir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filteredRows, state.sortCol, state.sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / state.pageSize));
  const page = Math.min(state.page, totalPages - 1);
  const pageRows = sortedRows.slice(page * state.pageSize, (page + 1) * state.pageSize);
  const rowOffset = page * state.pageSize;

  function handleSort(col: string) {
    if (state.sortCol === col) {
      dispatch({ type: "setSort", col, dir: state.sortDir === "asc" ? "desc" : "asc" });
    } else {
      dispatch({ type: "setSort", col, dir: "asc" });
    }
  }

  function SortIcon({ col }: { col: string }) {
    if (state.sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return state.sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 text-indigo-600" />
      : <ArrowDown className="w-3 h-3 text-indigo-600" />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Grid header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[color:var(--border)] bg-gray-50 shrink-0">
        <span className="text-xs text-[color:var(--muted)]">
          {sortedRows.length.toLocaleString()} rows
          {state.nbackFilter && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100 text-[10px]">
              filtered
            </span>
          )}
        </span>

        {editable && (
          <div className="ml-auto flex items-center gap-1">
            <button
              className="btn btn-ghost text-xs flex items-center gap-1"
              title="Append an empty row"
              onClick={() => {
                dispatch({ type: "addRow" });
                dispatch({ type: "setPage", page: Math.ceil((sortedRows.length + 1) / state.pageSize) - 1 });
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Row
            </button>
            <div className="relative">
              <button
                className="btn btn-ghost text-xs flex items-center gap-1"
                title="Add an empty column"
                onClick={() => setShowAddColumn((v) => !v)}
              >
                <Plus className="w-3.5 h-3.5" /> Column
              </button>
              {showAddColumn && (
                <AddColumnPopover
                  schema={state.schema}
                  onAdd={(key, label, columnType) => dispatch({ type: "addColumn", key, label, columnType })}
                  onClose={() => setShowAddColumn(false)}
                />
              )}
            </div>
          </div>
        )}

        <div className={`relative ${editable ? "" : "ml-auto"}`}>
          <button
            className="btn btn-ghost text-xs flex items-center gap-1"
            onClick={() => setShowColumnPicker((v) => !v)}
          >
            <Columns3 className="w-3.5 h-3.5" /> Columns
          </button>
          {showColumnPicker && (
            <ColumnPicker
              allColumns={allCols}
              visibleColumns={visibleCols}
              schema={state.schema}
              onToggle={(col) => dispatch({ type: "toggleColumn", col })}
              onClose={() => setShowColumnPicker(false)}
            />
          )}
        </div>

        {/* Page size selector */}
        <select
          className="select text-xs py-0.5"
          value={state.pageSize}
          onChange={(e) => dispatch({ type: "setPageSize", size: Number(e.target.value) as 50 | 100 | 200 | 500 })}
        >
          <option value={50}>50 rows</option>
          <option value={100}>100 rows</option>
          <option value={200}>200 rows</option>
          <option value={500}>500 rows</option>
        </select>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto min-h-0">
        {sortedRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[color:var(--muted)] p-8">
            {state.nbackFilter
              ? "No rows match the current filter. Select a different test from the left panel."
              : editable
                ? "No rows in this dataset. Use “+ Row” above to add one."
                : "No data loaded. Check the project has sessions with trial data."}
          </div>
        ) : (
          <table className="text-xs w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100">
                {/* Row number column */}
                <th className="sticky left-0 z-20 bg-gray-100 px-2 py-2 text-right text-[color:var(--muted)] border-b border-r border-[color:var(--border)] select-none w-12 font-medium">
                  #
                </th>
                {visibleCols.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left border-b border-[color:var(--border)] whitespace-nowrap font-medium cursor-pointer select-none hover:bg-gray-200 group"
                    onClick={() => handleSort(col)}
                  >
                    <span className="flex items-center gap-1">
                      <span className="truncate max-w-[120px]" title={state.schema[col]?.label ?? col}>
                        {state.schema[col]?.label ?? col}
                      </span>
                      <SortIcon col={col} />
                      {editable && (
                        <button
                          className="opacity-0 group-hover:opacity-100 text-[color:var(--muted)] hover:text-red-600 transition-opacity"
                          title="Delete column"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete column "${state.schema[col]?.label ?? col}"? Its values are removed from every row.`)) {
                              dispatch({ type: "deleteColumn", col });
                            }
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                    <span className="text-[9px] font-normal text-[color:var(--muted)] block">
                      {state.schema[col]?.type ?? ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                const stimType = String(row.stim_type ?? "");
                const rowColorClass = STIM_COLORS[stimType] ?? "";
                return (
                  <tr
                    key={i}
                    className={`group/row hover:bg-indigo-50/30 even:bg-gray-50/50 ${rowColorClass}`}
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-2 py-1 text-right text-[color:var(--muted)] border-r border-[color:var(--border)] tabular-nums whitespace-nowrap">
                      {editable && (
                        <button
                          className="opacity-0 group-hover/row:opacity-100 align-middle mr-1 text-[color:var(--muted)] hover:text-red-600 transition-opacity"
                          title="Delete row"
                          onClick={() => dispatch({ type: "deleteRow", rowRef: row })}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {rowOffset + i + 1}
                    </td>
                    {visibleCols.map((col) => {
                      const isEditing = editing?.rowRef === row && editing?.col === col;
                      if (isEditing) {
                        return (
                          <td key={col} className="px-1 py-0.5 border-b border-[color:var(--border)] max-w-[180px]">
                            <input
                              autoFocus
                              className={`w-full text-xs px-2 py-0.5 border border-indigo-400 rounded outline-none ${cellClass(state.schema[col])}`}
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") setEditing(null);
                              }}
                            />
                          </td>
                        );
                      }
                      const v = formatCell(row[col]);
                      return (
                        <td
                          key={col}
                          className={`px-3 py-1 border-b border-[color:var(--border)] max-w-[180px] truncate ${cellClass(state.schema[col])} ${editable ? "cursor-text" : ""}`}
                          title={editable ? (v ? `${v} — double-click to edit` : "Double-click to edit") : v}
                          onDoubleClick={() => startEdit(row, col)}
                        >
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination bar */}
      {sortedRows.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[color:var(--border)] bg-gray-50 shrink-0">
          <button
            className="btn btn-ghost text-xs p-1 disabled:opacity-40"
            disabled={page === 0}
            onClick={() => dispatch({ type: "setPage", page: page - 1 })}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 text-xs">
            {Array.from({ length: Math.min(7, totalPages) }, (_, idx) => {
              let p: number;
              if (totalPages <= 7) {
                p = idx;
              } else if (page < 4) {
                p = idx < 5 ? idx : idx === 5 ? -1 : totalPages - 1;
              } else if (page > totalPages - 5) {
                p = idx === 0 ? 0 : idx === 1 ? -1 : totalPages - 7 + idx;
              } else {
                p = idx === 0 ? 0 : idx === 1 ? -1 : idx === 5 ? -1 : idx === 6 ? totalPages - 1 : page - 2 + idx;
              }
              if (p === -1) return <span key={`ellipsis-${idx}`} className="px-1 text-[color:var(--muted)]">…</span>;
              return (
                <button
                  key={p}
                  onClick={() => dispatch({ type: "setPage", page: p })}
                  className={`w-6 h-6 rounded text-xs ${p === page ? "bg-indigo-600 text-white" : "hover:bg-gray-200"}`}
                >
                  {p + 1}
                </button>
              );
            })}
          </div>

          <button
            className="btn btn-ghost text-xs p-1 disabled:opacity-40"
            disabled={page >= totalPages - 1}
            onClick={() => dispatch({ type: "setPage", page: page + 1 })}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="ml-auto text-xs text-[color:var(--muted)]">
            {rowOffset + 1}–{Math.min(rowOffset + state.pageSize, sortedRows.length)} of {sortedRows.length.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
