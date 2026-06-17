"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, ChevronDown, Loader2 } from "lucide-react";
import { AnalyzeMenu } from "@/components/stats/workspace/AnalyzeMenu";
import { SessionFile } from "@/components/stats/workspace/SessionFile";
import { GraphsMenu } from "./GraphsMenu";
import { useWorkspace } from "@/components/stats/workspace/WorkspaceProvider";
import { useWorkbench } from "@/contexts/WorkbenchContext";
import { rowsToCsv } from "@/lib/analytics/csvParser";
import { uploadCsvAsDataset } from "@/lib/analytics/uploadDataset";
import { downloadText } from "@/lib/csv";
import { notify } from "@/lib/toast";

interface WorkbenchToolbarProps {
  onTransform: () => void;
  onImport: () => void;
}

export function WorkbenchToolbar({ onTransform, onImport }: WorkbenchToolbarProps) {
  const ws = useWorkspace();
  const { state, filteredRows, source } = useWorkbench();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // "Upload as new dataset" — only meaningful inside a project workbench; the
  // new standalone dataset is linked to this project.
  const projectId = source.kind === "project" ? source.projectId : null;

  async function uploadAsDataset(file: File) {
    setUploading(true);
    try {
      const created = await uploadCsvAsDataset(file, { projectId });
      notify.success("Dataset uploaded");
      router.push(`/dashboard/datasets/${created.id}/analytics`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
    }
  }

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
      <ImportMenu
        onImportCsv={onImport}
        showUploadDataset={projectId != null}
        uploading={uploading}
        onUploadDataset={() => fileRef.current?.click()}
      />

      {/* Export dropdown */}
      <ExportMenu rows={state.rows} filteredRows={filteredRows} schema={state.schema} visibleColumns={state.visibleColumns} />

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadAsDataset(f);
          e.target.value = "";
        }}
      />

      <div className="ml-auto">
        <SessionFile />
      </div>
    </div>
  );
}

function ImportMenu({
  onImportCsv, showUploadDataset, uploading, onUploadDataset,
}: {
  onImportCsv: () => void;
  showUploadDataset: boolean;
  uploading: boolean;
  onUploadDataset: () => void;
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

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn btn-ghost text-xs flex items-center gap-1"
        onClick={() => setOpen((o) => !o)}
      >
        <Upload className="w-3 h-3" /> Import <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-[color:var(--border)] rounded-xl shadow-xl py-2 w-56">
          <button
            onClick={() => { onImportCsv(); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-indigo-50 hover:text-indigo-700"
          >
            Import CSV data (merge rows)
          </button>
          {showUploadDataset && (
            <button
              onClick={() => { onUploadDataset(); setOpen(false); }}
              disabled={uploading}
              className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-1.5 disabled:opacity-60"
            >
              {uploading && <Loader2 className="w-3 h-3 animate-spin" />}
              Upload as new dataset
            </button>
          )}
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
