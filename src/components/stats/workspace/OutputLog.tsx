"use client";
import { useWorkspace } from "./WorkspaceProvider";
import { OutputEntry } from "@/lib/stats";
import { Pin, PinOff, Trash2, FileText, Download } from "lucide-react";
import { downloadBlob } from "@/lib/analytics/download";

function downloadAllOutputs(entries: OutputEntry[], projectId: string) {
  const date = new Date().toLocaleString();
  const dateSlug = new Date().toISOString().slice(0, 10);
  const sections = entries.map((e) => `
    <div class="entry">
      <h2>${e.title}${e.pinned ? ' <span class="pinned">· pinned</span>' : ''}</h2>
      <div class="ts">${new Date(e.timestamp).toLocaleString()}</div>
      <div class="snapshot">${e.htmlSnapshot}</div>
    </div>`).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Neurogauge Analyses — ${dateSlug}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; color: #111; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    h2 { font-size: 14px; font-weight: 700; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
    .entry { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .ts { font-size: 11px; color: #6b7280; margin-bottom: 10px; }
    .pinned { color: #4f46e5; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 4px 8px; text-align: left; font-size: 12px; }
    th { font-weight: 600; }
    svg { max-width: 100%; height: auto; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Neurogauge Analysis Output</h1>
  <p class="meta">Generated ${date} &middot; Project ${projectId} &middot; ${entries.length} analysis${entries.length !== 1 ? "es" : ""}</p>
  ${sections}
</body>
</html>`;

  downloadBlob(new Blob([html], { type: "text/html" }), `neurogauge_analyses_${dateSlug}.html`);
}

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
            <button className="btn btn-ghost text-xs flex items-center gap-1"
              onClick={() => downloadAllOutputs(entries, ws.state.projectId ?? "project")}
              title="Download all analyses as a single HTML file">
              <Download className="w-3.5 h-3.5" /> Download all
            </button>
          )}
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
