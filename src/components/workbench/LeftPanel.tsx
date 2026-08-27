"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NBackTree } from "./NBackTree";
import { VariableBrowser } from "@/components/stats/workspace/VariableBrowser";
import { useResizable } from "./useResizable";

interface LeftPanelProps {
  onEdit: (variableId: string) => void;
  onNewTransform: () => void;
}

export function LeftPanel({ onEdit, onNewTransform }: LeftPanelProps) {
  const [showVars, setShowVars] = useState(true);
  const { size: width, dragging, onPointerDown } = useResizable({
    storageKey: "wb:leftWidth",
    initial: 224, // w-56
    min: 160,
    max: 520,
    axis: "x",
  });

  return (
    <aside
      className="relative flex flex-col border-r border-[color:var(--border)] bg-white overflow-hidden shrink-0"
      style={{ width }}
    >
      {/* N-Back test tree */}
      <div className="border-b border-[color:var(--border)] overflow-y-auto" style={{ maxHeight: "50%" }}>
        <NBackTree />
      </div>

      {/* Variable browser collapsible */}
      <div className="flex flex-col min-h-0 flex-1">
        <button
          className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-[color:var(--muted)] hover:bg-gray-50 border-b border-[color:var(--border)] w-full text-left"
          onClick={() => setShowVars((v) => !v)}
        >
          {showVars ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Variables
        </button>
        {showVars && (
          <div className="flex-1 overflow-hidden min-h-0">
            <VariableBrowser onEdit={onEdit} onNewTransform={onNewTransform} />
          </div>
        )}
      </div>

      {/* Drag handle — right edge */}
      <div
        onPointerDown={onPointerDown}
        title="Drag to resize"
        className={`absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-300/60 transition-colors ${
          dragging ? "bg-indigo-400/70" : "bg-transparent"
        }`}
      />
    </aside>
  );
}
