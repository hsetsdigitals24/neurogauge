"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { DialogKey } from "@/lib/stats";
import { useWorkspace } from "@/components/stats/workspace/WorkspaceProvider";

const GRAPH_ITEMS: { key: DialogKey; label: string }[] = [
  { key: "descriptive", label: "Histogram / bar chart" },
  { key: "correlation", label: "Scatter plot" },
  { key: "normality",   label: "Q-Q plot" },
  { key: "anova",       label: "Box plot by group" },
];

export function GraphsMenu() {
  const ws = useWorkspace();
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
        Graphs <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-[color:var(--border)] rounded-xl shadow-xl py-2 w-48">
          {GRAPH_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                ws.dispatch({ type: "openDialog", key: item.key });
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-indigo-50 hover:text-indigo-700"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
