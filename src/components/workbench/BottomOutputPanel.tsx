"use client";
import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useWorkspace } from "@/components/stats/workspace/WorkspaceProvider";
import { OutputLog } from "@/components/stats/workspace/OutputLog";
import { useReportExport } from "@/components/stats/workspace/ReportExport";
import { useResizable } from "./useResizable";

export function BottomOutputPanel() {
  const ws = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const exportReport = useReportExport();
  const count = ws.state.outputs.length;
  const { size: height, dragging, onPointerDown } = useResizable({
    storageKey: "wb:outputHeight",
    initial: 220,
    min: 120,
    max: 640,
    axis: "y",
    invert: true, // handle on top edge: pointer up ⇒ taller
  });

  return (
    <div
      className={`relative border-t border-[color:var(--border)] bg-white shrink-0 flex flex-col ${
        dragging ? "" : "transition-all duration-200"
      }`}
      style={{ height: collapsed ? 40 : height }}
    >
      {/* Drag handle — top edge (only when expanded) */}
      {!collapsed && (
        <div
          onPointerDown={onPointerDown}
          title="Drag to resize"
          className={`absolute top-0 left-0 w-full h-1.5 -translate-y-1/2 cursor-row-resize hover:bg-indigo-300/60 transition-colors z-10 ${
            dragging ? "bg-indigo-400/70" : "bg-transparent"
          }`}
        />
      )}

      {/* Header strip */}
      <button
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--muted)] hover:bg-gray-50 w-full text-left border-b border-[color:var(--border)] shrink-0"
        onClick={() => setCollapsed((v) => !v)}
      >
        {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        <span className="uppercase tracking-widest">Output</span>
        {count > 0 && (
          <span className="ml-1 px-1.5 py-0 rounded-full bg-indigo-100 text-indigo-700 text-[10px]">
            {count}
          </span>
        )}
        {!collapsed && count === 0 && (
          <span className="text-[color:var(--muted)] font-normal normal-case tracking-normal">
            — run an analysis to log results here
          </span>
        )}
      </button>

      {/* Output log (only when expanded) */}
      {!collapsed && (
        <div className="flex-1 overflow-hidden min-h-0">
          <OutputLog onExportReport={exportReport} />
        </div>
      )}
    </div>
  );
}
