"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useWorkbench } from "@/contexts/WorkbenchContext";
import type { NBackFilter, StimulusType, Level } from "@/lib/analytics/workbenchState";

const STIM_TYPES: { value: StimulusType; label: string; color: string }[] = [
  { value: "letters",   label: "Letters",   color: "bg-cyan-500" },
  { value: "shapes",    label: "Shapes",    color: "bg-purple-500" },
  { value: "rotated-e", label: "Rotated E", color: "bg-amber-500" },
];

const LEVELS: { value: Level; label: string }[] = [
  { value: 0, label: "0-back (Control)" },
  { value: 1, label: "1-back" },
  { value: 2, label: "2-back" },
  { value: 3, label: "3-back" },
];

function isActive(filter: NBackFilter | null, stimType: StimulusType, level?: Level): boolean {
  if (!filter) return false;
  if (level === undefined) return filter.stimType === stimType && filter.level === null;
  return filter.stimType === stimType && filter.level === level;
}

function isAllActive(filter: NBackFilter | null): boolean {
  return filter === null;
}

export function NBackTree() {
  const { state, dispatch, filteredRows, totalRows } = useWorkbench();
  const [expanded, setExpanded] = useState<Set<StimulusType>>(new Set(["letters"]));

  function toggle(stim: StimulusType) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(stim) ? next.delete(stim) : next.add(stim);
      return next;
    });
  }

  function select(filter: NBackFilter | null) {
    dispatch({ type: "setNBackFilter", filter });
  }

  const countFor = (stimType?: StimulusType, level?: Level) => {
    const all = [...state.rows, ...state.importedRows];
    return all.filter((r) => {
      if (stimType && r.stim_type !== stimType) return false;
      if (level !== undefined && r.level !== level) return false;
      return true;
    }).length;
  };

  return (
    <div className="select-none text-sm">
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-[color:var(--muted)]">
        N-Back Tests
      </div>

      {/* All */}
      <button
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md mx-1 text-left text-sm transition-colors ${isAllActive(state.nbackFilter) ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-gray-100 text-gray-700"}`}
        onClick={() => select(null)}
      >
        <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
        <span className="flex-1 truncate">All tests</span>
        <span className="text-[10px] text-[color:var(--muted)] tabular-nums">{totalRows}</span>
      </button>

      {STIM_TYPES.map(({ value: stim, label, color }) => {
        const isOpen = expanded.has(stim);
        const stimCount = countFor(stim);
        if (stimCount === 0) return null;

        return (
          <div key={stim}>
            <button
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md mx-1 text-left text-sm transition-colors ${isActive(state.nbackFilter, stim) ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-gray-100 text-gray-700"}`}
              onClick={() => {
                toggle(stim);
                select({ stimType: stim, level: null });
              }}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
              <span className="flex-1 truncate">{label}</span>
              <span className="text-[10px] text-[color:var(--muted)] tabular-nums mr-1">{stimCount}</span>
              {isOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
            </button>

            {isOpen && (
              <div className="ml-4">
                {LEVELS.map(({ value: lvl, label: lvlLabel }) => {
                  const lvlCount = countFor(stim, lvl);
                  if (lvlCount === 0) return null;
                  const active = isActive(state.nbackFilter, stim, lvl);
                  return (
                    <button
                      key={lvl}
                      className={`w-full flex items-center gap-2 px-3 py-1 rounded-md mx-1 text-left text-xs transition-colors ${active ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-gray-100 text-gray-600"}`}
                      onClick={() => select({ stimType: stim, level: lvl })}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color} ${active ? "opacity-100" : "opacity-50"}`} />
                      <span className="flex-1 truncate">{lvlLabel}</span>
                      <span className="text-[10px] text-[color:var(--muted)] tabular-nums">{lvlCount}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Row count summary */}
      <div className="px-3 py-2 mt-1 text-[10px] text-[color:var(--muted)] border-t border-[color:var(--border)]">
        {filteredRows.length === totalRows
          ? `${totalRows.toLocaleString()} rows`
          : `${filteredRows.length.toLocaleString()} / ${totalRows.toLocaleString()} rows`}
      </div>
    </div>
  );
}
