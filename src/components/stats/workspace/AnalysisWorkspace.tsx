"use client";
import { useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { VariableBrowser } from "./VariableBrowser";
import { VariableEditor } from "./VariableEditor";
import { TransformDialog } from "./TransformDialog";
import { FilterBar } from "./FilterBar";
import { DataView } from "./DataView";
import { VariableView } from "./VariableView";
import { AnalyzeMenu } from "./AnalyzeMenu";
import { DialogHost } from "./DialogHost";
import { OutputLog } from "./OutputLog";
import { SessionFile } from "./SessionFile";
import { useReportExport } from "./ReportExport";
import { Database, Table } from "lucide-react";

export function AnalysisWorkspace() {
  const ws = useWorkspace();
  const [showTransform, setShowTransform] = useState(false);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const exportReport = useReportExport();

  return (
    <div className="card overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[color:var(--border)] bg-white">
        <AnalyzeMenu onPick={(key) => ws.dispatch({ type: "openDialog", key })} />
        <button
          onClick={() => setShowTransform(true)}
          className="btn btn-ghost text-xs"
        >
          Transform
        </button>
        <div className="ml-auto">
          <SessionFile />
        </div>
      </div>

      <FilterBar />

      {/* Three-pane body */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr_320px] min-h-[600px] max-h-[80vh]">
        {/* Left pane */}
        <aside className="border-r border-[color:var(--border)] overflow-hidden hidden md:block">
          <VariableBrowser
            onEdit={(id) => setEditingVarId(id)}
            onNewTransform={() => setShowTransform(true)}
          />
        </aside>

        {/* Center pane */}
        <main className="border-r border-[color:var(--border)] overflow-hidden flex flex-col">
          {ws.state.activeDialog ? (
            <DialogHost dialogKey={ws.state.activeDialog} />
          ) : (
            <>
              <div className="flex items-center gap-1 px-3 py-2 border-b border-[color:var(--border)]">
                <button
                  className={`btn text-xs flex items-center gap-1 ${ws.state.centerTab === "data" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => ws.dispatch({ type: "setCenter", tab: "data" })}
                >
                  <Database className="w-3.5 h-3.5" /> Data view
                </button>
                <button
                  className={`btn text-xs flex items-center gap-1 ${ws.state.centerTab === "variable" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => ws.dispatch({ type: "setCenter", tab: "variable" })}
                >
                  <Table className="w-3.5 h-3.5" /> Variable view
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {ws.state.centerTab === "data" && <DataView />}
                {ws.state.centerTab === "variable" && <VariableView onEdit={(id) => setEditingVarId(id)} />}
                {ws.state.centerTab === "dialog" && (
                  <p className="p-6 text-sm text-[color:var(--muted)]">Choose an analysis from the Analyze menu.</p>
                )}
              </div>
            </>
          )}
        </main>

        {/* Right pane */}
        <aside className="hidden md:flex flex-col overflow-hidden">
          <OutputLog onExportReport={exportReport} />
        </aside>
      </div>

      {/* Modals */}
      {showTransform && <TransformDialog onClose={() => setShowTransform(false)} />}
      {editingVarId && <VariableEditor variableId={editingVarId} onClose={() => setEditingVarId(null)} />}
    </div>
  );
}
