"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Database, Upload, Trash2, ChevronRight, ArrowLeft, Loader2, Table2, X } from "lucide-react";
import { uploadCsvAsDataset, uploadSheetAsDataset } from "@/lib/analytics/uploadDataset";
import { isSpreadsheetFile, readWorkbook } from "@/lib/analytics/spreadsheetParser";
import { notify } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

const UPLOAD_ACCEPT =
  ".csv,.xlsx,.xls,.xlsm,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

interface DatasetRow {
  id: string;
  name: string;
  n: number;
  projectId: string | null;
  updatedAt: string;
  createdAt: string;
}

export default function DatasetsPage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [batch, setBatch] = useState<{ index: number; total: number } | null>(null);
  const [pendingWorkbook, setPendingWorkbook] = useState<{ file: File; sheetNames: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/datasets")
      .then((r) => (r.ok ? r.json() : { datasets: [] }))
      .then((data) => { if (!cancelled) setDatasets(data.datasets ?? []); })
      .catch(() => { if (!cancelled) notify.error("Could not load datasets"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const sheetResolver = useRef<((sheet: string | null) => void) | null>(null);

  /** Show the sheet picker and resolve with the chosen sheet (null = skipped). */
  function pickSheet(file: File, sheetNames: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      sheetResolver.current = resolve;
      setPendingWorkbook({ file, sheetNames });
    });
  }

  function resolveSheet(sheet: string | null) {
    setPendingWorkbook(null);
    const r = sheetResolver.current;
    sheetResolver.current = null;
    r?.(sheet);
  }

  async function uploadOne(file: File): Promise<DatasetRow | null> {
    const onProgress = (pct: number) => setProgress(Math.round(pct));
    if (isSpreadsheetFile(file)) {
      // Inspect sheets first; let the user pick when there is more than one tab.
      const wb = await readWorkbook(file);
      if (wb.sheetNames.length === 0) throw new Error("Workbook has no sheets.");
      const sheet = wb.sheetNames.length === 1 ? wb.sheetNames[0] : await pickSheet(file, wb.sheetNames);
      if (sheet == null) return null;
      const created = await uploadSheetAsDataset(file, sheet, { onProgress });
      return toRow(created);
    }
    const created = await uploadCsvAsDataset(file, { onProgress });
    return toRow(created);
  }

  function toRow(c: { id: string; name: string; n: number; projectId: string | null }): DatasetRow {
    const now = new Date().toISOString();
    return { ...c, updatedAt: now, createdAt: now };
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    const created: DatasetRow[] = [];
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(null);
      setBatch(files.length > 1 ? { index: i + 1, total: files.length } : null);
      try {
        const row = await uploadOne(file);
        if (row) {
          created.push(row);
          setDatasets((ds) => [row, ...ds.filter((d) => d.id !== row.id)]);
        }
      } catch (e) {
        failed++;
        notify.error(`${file.name}: ${e instanceof Error ? e.message : "Upload failed"}`);
      }
    }
    setUploading(false);
    setProgress(null);
    setBatch(null);

    // Single file: keep the old behaviour of jumping straight into the workbench.
    if (files.length === 1 && created.length === 1) {
      notify.success("Dataset uploaded");
      router.push(`/dashboard/datasets/${created[0].id}/analytics`);
      return;
    }
    if (created.length > 0) {
      notify.success(
        `${created.length} dataset${created.length === 1 ? "" : "s"} uploaded` +
          (failed > 0 ? `, ${failed} failed` : "")
      );
    }
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: "Delete dataset", message: "Delete this dataset? This cannot be undone.", confirmLabel: "Delete" }))) return;
    const res = await fetch(`/api/datasets/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDatasets((ds) => ds.filter((d) => d.id !== id));
      notify.success("Dataset deleted");
    } else {
      const data = await res.json().catch(() => ({}));
      notify.error(data.error ?? "Failed to delete dataset");
    }
  }

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-6xl mx-auto w-full">
        <div className="mt-6">
          <Link href="/dashboard" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">
              Your <span className="gradient-text">datasets</span>
            </h1>
            <p className="text-[color:var(--muted)] mt-1 text-sm">
              Upload CSV or Excel spreadsheets (several at once if you like) and analyse it in the workbench — columns and types are fully editable.
            </p>
          </div>
          <button
            className="btn btn-primary flex items-center gap-2 disabled:opacity-60"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading
              ? `Uploading${batch ? ` ${batch.index}/${batch.total}` : ""}…${progress != null ? ` ${progress}%` : ""}`
              : "Upload data"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              handleFiles(files);
            }}
          />
        </motion.div>

        {loading && (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading datasets…</div>
        )}

        {!loading && datasets.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 card p-10 text-center">
            <Database className="w-12 h-12 mx-auto text-[color:var(--muted)] mb-4" />
            <h2 className="text-xl font-bold">No datasets yet</h2>
            <p className="text-sm text-[color:var(--muted)] mt-2 mb-6">
              Upload a CSV or Excel spreadsheet to start analysing arbitrary data.
            </p>
            <button className="btn btn-primary" disabled={uploading} onClick={() => inputRef.current?.click()}>
              Upload data
            </button>
          </motion.div>
        )}

        {!loading && datasets.length > 0 && (
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {datasets.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="card p-5 hover:shadow-lg transition-shadow group flex items-start justify-between gap-3">
                  <Link href={`/dashboard/datasets/${d.id}/analytics`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base truncate">{d.name}</h3>
                      {d.projectId && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                          from project
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-[color:var(--muted)]">
                      <span className="flex items-center gap-1">
                        <Table2 className="w-4 h-4" /> {d.n.toLocaleString()} rows
                      </span>
                      <span className="text-xs">{new Date(d.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className="btn btn-ghost p-2 text-[color:var(--danger)]"
                      title="Delete dataset"
                      onClick={() => remove(d.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link href={`/dashboard/datasets/${d.id}/analytics`} className="btn btn-ghost p-2">
                      <ChevronRight className="w-5 h-5 text-[color:var(--muted)]" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {pendingWorkbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
              <h2 className="font-bold text-base">Choose a sheet</h2>
              <button className="btn btn-ghost p-1" title="Skip this file" onClick={() => resolveSheet(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[color:var(--muted)] mb-3">
                <span className="font-semibold text-[color:var(--fg)]">{pendingWorkbook.file.name}</span> has{" "}
                {pendingWorkbook.sheetNames.length} sheets. Pick the one to import.
              </p>
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {pendingWorkbook.sheetNames.map((name) => (
                  <button
                    key={name}
                    className="btn btn-ghost justify-between text-sm border border-[color:var(--border)] hover:border-indigo-400"
                    onClick={() => resolveSheet(name)}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Table2 className="w-4 h-4 shrink-0" /> {name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[color:var(--muted)] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
