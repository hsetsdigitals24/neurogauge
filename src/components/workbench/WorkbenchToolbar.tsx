"use client";
import { useState, useRef, useEffect } from "react";
import { Download, Upload, ChevronDown } from "lucide-react";
import { AnalyzeMenu } from "@/components/stats/workspace/AnalyzeMenu";
import { SessionFile } from "@/components/stats/workspace/SessionFile";
import { GraphsMenu } from "./GraphsMenu";
import { useWorkspace } from "@/components/stats/workspace/WorkspaceProvider";
import { useWorkbench } from "@/contexts/WorkbenchContext";
import { rowsToCsv } from "@/lib/analytics/csvParser";
import { downloadText } from "@/lib/csv";

interface WorkbenchToolbarProps {
  onTransform: () => void;
  onImport: () => void;
}

export function WorkbenchToolbar({ onTransform, onImport }: WorkbenchToolbarProps) {
  const ws = useWorkspace();
  const { state, filteredRows } = useWorkbench();

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-[color:var(--border)] bg-white shrink-0 flex-wrap">
      {/* Analyze menu (SPSS-style) */}
      <AnalyzeMenu onPick={(key) => ws.dispatch({ type: "openDialog", key })} />

      {/* Transform */}
      <button className="btn btn-ghost text-xs" onClick={onTransform}>
        Transform
      </button>

      {/* Graphs */}
      <GraphsMenu />

      {/* Import dropdown */}
      <ImportMenu onImportCsv={onImport} />

      {/* Export dropdown */}
      <ExportMenu rows={state.rows} filteredRows={filteredRows} schema={state.schema} visibleColumns={state.visibleColumns} />

      <div className="ml-auto">
        <SessionFile />
      </div>
    </div>
  );
}

function ImportMenu({ onImportCsv }: { onImportCsv: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn btn-ghost text-xs flex items-center gap-1"
        onClick={() => setOpen((o) => !o)}
      >
        <Upload className="w-3 h-3" /> Import <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-[color:var(--border)] rounded-xl shadow-xl py-2 w-44">
          <button
            onClick={() => { onImportCsv(); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-indigo-50 hover:text-indigo-700"
          >
            Import CSV data
          </button>
        </div>
      )}
    </div>
  );
}

function ExportMenu({
  rows,
  filteredRows,
  schema,
  visibleColumns,
}: {
  rows: Record<string, unknown>[];
  filteredRows: Record<string, unknown>[];
  schema: Record<string, unknown>;
  visibleColumns: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const allCols = Object.keys(schema);

  function exportFull() {
    const csv = rowsToCsv(rows, allCols);
    downloadText(`dataset_full_${Date.now()}.csv`, csv);
    setOpen(false);
  }

  function exportFiltered() {
    const csv = rowsToCsv(filteredRows, visibleColumns);
    downloadText(`dataset_filtered_${Date.now()}.csv`, csv);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn btn-ghost text-xs flex items-center gap-1"
        onClick={() => setOpen((o) => !o)}
      >
        <Download className="w-3 h-3" /> Export <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-[color:var(--border)] rounded-xl shadow-xl py-2 w-52">
          <button
            onClick={exportFull}
            className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-indigo-50 hover:text-indigo-700"
          >
            Export all data (CSV)
          </button>
          <button
            onClick={exportFiltered}
            className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-indigo-50 hover:text-indigo-700"
          >
            Export filtered / visible (CSV)
          </button>
        </div>
      )}
    </div>
  );
}
