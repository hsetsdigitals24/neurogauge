"use client";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Database, Table } from "lucide-react";
import { WorkspaceProvider } from "@/components/stats/workspace/WorkspaceProvider";
import { FilterBar } from "@/components/stats/workspace/FilterBar";
import { VariableEditor } from "@/components/stats/workspace/VariableEditor";
import { TransformDialog } from "@/components/stats/workspace/TransformDialog";
import { VariableView } from "@/components/stats/workspace/VariableView";
import { WorkbenchContext } from "@/contexts/WorkbenchContext";
import {
  workbenchReducer,
  makeInitialState,
  deriveRows,
} from "@/lib/analytics/workbenchState";
import type { ComputedColumnDef } from "@/lib/analytics/computeColumn";
import type { DatasetResponse, AnalysisSource } from "@/lib/analytics/client";
import type { CustomQuestion } from "@/lib/types";
import { WorkbenchToolbar } from "./WorkbenchToolbar";
import { LeftPanel } from "./LeftPanel";
import { DataGrid } from "./DataGrid";
import { AnalysisSlidePanel } from "./AnalysisSlidePanel";
import { BottomOutputPanel } from "./BottomOutputPanel";
import { ImportCsvDialog } from "./ImportCsvDialog";
import { DatasetVariableView } from "./DatasetVariableView";
import { ComputedColumnDialog } from "./ComputedColumnDialog";

interface WorkbenchShellProps {
  source: AnalysisSource;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[];
  questions: CustomQuestion[];
  dataset: DatasetResponse;
}

type CenterTab = "data" | "variables";

export function WorkbenchShell({
  source,
  sessions,
  questions,
  dataset,
}: WorkbenchShellProps) {
  // Opaque key for WorkspaceProvider seeding + localStorage namespacing.
  const workspaceKey = source.kind === "project" ? source.projectId : source.datasetId;
  const isDataset = source.kind === "dataset";
  const datasetId = source.kind === "dataset" ? source.datasetId : null;

  const initial = useMemo(
    () => makeInitialState(
      dataset.rows,
      dataset.schema,
      (dataset.computedColumns as ComputedColumnDef[] | undefined) ?? []
    ),
    [dataset]
  );
  const [workbenchState, workbenchDispatch] = useReducer(workbenchReducer, initial);
  const [centerTab, setCenterTab] = useState<CenterTab>("data");
  const [showImport, setShowImport] = useState(false);
  const [showTransform, setShowTransform] = useState(false);
  const [showComputed, setShowComputed] = useState(false);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);

  const filteredRows = useMemo(() => deriveRows(workbenchState), [workbenchState]);
  const totalRows = workbenchState.rows.length + workbenchState.importedRows.length;

  // Persist schema retypes/renames + computed columns back to the stored dataset.
  // Rows only travel when computed columns change — and never for blob-backed
  // datasets (function body cap); those re-apply computed columns from defs on load.
  const rowsPersisted = dataset.rowsPersisted !== false;
  const skipFirstPersist = useRef(true);
  const lastComputedRef = useRef(workbenchState.computedColumns);
  useEffect(() => {
    if (!datasetId) return;
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      lastComputedRef.current = workbenchState.computedColumns;
      return;
    }
    const rowsChanged = lastComputedRef.current !== workbenchState.computedColumns;
    lastComputedRef.current = workbenchState.computedColumns;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = {
      schema: workbenchState.schema,
      computedColumns: workbenchState.computedColumns,
    };
    if (rowsChanged && rowsPersisted) body.rows = workbenchState.rows;
    const t = setTimeout(() => {
      fetch(`/api/datasets/${datasetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [datasetId, rowsPersisted, workbenchState.schema, workbenchState.computedColumns, workbenchState.rows]);

  const workbenchCtx = useMemo(
    () => ({
      state: workbenchState,
      dispatch: workbenchDispatch,
      filteredRows,
      totalRows,
      source,
    }),
    [workbenchState, filteredRows, totalRows, source]
  );

  return (
    <WorkspaceProvider projectId={workspaceKey} sessions={sessions} questions={questions}>
      <WorkbenchContext.Provider value={workbenchCtx}>
        {/* Full-screen column layout */}
        <div className="flex flex-col h-full min-h-0 overflow-hidden bg-white">

          {/* Toolbar */}
          <WorkbenchToolbar
            onTransform={() => setShowTransform(true)}
            onImport={() => setShowImport(true)}
          />

          {/* Filter bar */}
          <FilterBar />

          {/* Body: left panel + center */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Left panel */}
            <LeftPanel
              onEdit={(id) => setEditingVarId(id)}
              onNewTransform={() => setShowTransform(true)}
            />

            {/* Center: tab bar + data grid or variable view + slide panel */}
            <div className="flex flex-col flex-1 min-w-0 relative overflow-hidden">
              {/* Tab bar */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-[color:var(--border)] bg-white shrink-0">
                <button
                  className={`btn text-xs flex items-center gap-1 ${centerTab === "data" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setCenterTab("data")}
                >
                  <Database className="w-3.5 h-3.5" /> Data View
                </button>
                <button
                  className={`btn text-xs flex items-center gap-1 ${centerTab === "variables" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setCenterTab("variables")}
                >
                  <Table className="w-3.5 h-3.5" /> Variable View
                </button>

                {/* Row count badge */}
                <span className="ml-auto text-xs text-[color:var(--muted)]">
                  {totalRows.toLocaleString()} total rows
                  {workbenchState.nbackFilter && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 text-[10px]">
                      {filteredRows.length.toLocaleString()} filtered
                    </span>
                  )}
                </span>
              </div>

              {/* Center content */}
              <div className="flex-1 overflow-hidden min-h-0 relative">
                {centerTab === "data" ? (
                  <DataGrid />
                ) : (
                  <div className="overflow-auto h-full p-3">
                    {isDataset ? (
                      <DatasetVariableView onNewComputed={() => setShowComputed(true)} />
                    ) : (
                      <VariableView onEdit={(id) => setEditingVarId(id)} />
                    )}
                  </div>
                )}

                {/* Analysis slide panel overlays from the right */}
                <AnalysisSlidePanel />
              </div>
            </div>
          </div>

          {/* Bottom output panel */}
          <BottomOutputPanel />
        </div>

        {/* Modals */}
        {showTransform && (
          <TransformDialog onClose={() => setShowTransform(false)} />
        )}
        {editingVarId && (
          <VariableEditor variableId={editingVarId} onClose={() => setEditingVarId(null)} />
        )}
        {showImport && (
          <ImportCsvDialog onClose={() => setShowImport(false)} />
        )}
        {showComputed && (
          <ComputedColumnDialog onClose={() => setShowComputed(false)} />
        )}
      </WorkbenchContext.Provider>
    </WorkspaceProvider>
  );
}
