"use client";
import { useWorkspace } from "./WorkspaceProvider";
import { OutputEntry } from "@/lib/stats";
import { Pin, PinOff, Trash2, FileText } from "lucide-react";

export function OutputLog({ onExportReport }: { onExportReport: () => void }) {
  const ws = useWorkspace();
  const entries = [...ws.state.outputs].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.timestamp - a.timestamp;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--border)]">
        <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Output ({entries.length})
        </span>
        <div className="flex gap-1">
          <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={onExportReport}>
            <FileText className="w-3.5 h-3.5" /> Report
          </button>
          {entries.length > 0 && (
            <button className="btn btn-ghost text-xs text-[color:var(--danger)]"
              onClick={() => { if (confirm("Clear all output?")) ws.dispatch({ type: "clearOutputs" }); }}>
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {entries.length === 0 && (
          <p className="text-xs text-[color:var(--muted)] text-center py-8 px-3">
            Run an analysis and click <strong>Run &amp; save to output</strong> to start a log.
          </p>
        )}
        {entries.map((e) => <Entry key={e.id} entry={e} />)}
      </div>
    </div>
  );
}

function Entry({ entry }: { entry: OutputEntry }) {
  const ws = useWorkspace();
  return (
    <div className={`card p-3 ${entry.pinned ? "ring-1 ring-indigo-300" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{entry.title}</div>
          <div className="text-[10px] text-[color:var(--muted)]">
            {new Date(entry.timestamp).toLocaleString()}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => ws.dispatch({ type: "togglePin", id: entry.id })}
            className="btn btn-ghost p-1" title={entry.pinned ? "Unpin" : "Pin"}>
            {entry.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => ws.dispatch({ type: "removeOutput", id: entry.id })}
            className="btn btn-ghost p-1 text-[color:var(--danger)]" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="prose prose-sm max-w-none text-xs output-snapshot"
        dangerouslySetInnerHTML={{ __html: entry.htmlSnapshot }} />
    </div>
  );
}
