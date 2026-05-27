"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NBackTree } from "./NBackTree";
import { VariableBrowser } from "@/components/stats/workspace/VariableBrowser";

interface LeftPanelProps {
  onEdit: (variableId: string) => void;
  onNewTransform: () => void;
}

export function LeftPanel({ onEdit, onNewTransform }: LeftPanelProps) {
  const [showVars, setShowVars] = useState(true);

  return (
    <aside className="flex flex-col border-r border-[color:var(--border)] bg-white overflow-hidden w-56 shrink-0">
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
    </aside>
  );
}
