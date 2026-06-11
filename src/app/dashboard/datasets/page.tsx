"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Database, Upload, Trash2, ChevronRight, ArrowLeft, Loader2, Table2 } from "lucide-react";
import { uploadCsvAsDataset } from "@/lib/analytics/uploadDataset";

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
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/datasets")
      .then((r) => (r.ok ? r.json() : { datasets: [] }))
      .then((data) => { if (!cancelled) setDatasets(data.datasets ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    setProgress(null);
    try {
      const created = await uploadCsvAsDataset(file, {
        onProgress: (pct) => setProgress(Math.round(pct)),
      });
      router.push(`/dashboard/datasets/${created.id}/analytics`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
      setProgress(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this dataset? This cannot be undone.")) return;
    const res = await fetch(`/api/datasets/${id}`, { method: "DELETE" });
    if (res.ok) setDatasets((ds) => ds.filter((d) => d.id !== id));
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
              Upload any CSV and analyse it in the workbench — columns and types are fully editable.
            </p>
          </div>
          <button
            className="btn btn-primary flex items-center gap-2 disabled:opacity-60"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? (progress != null ? `Uploading… ${progress}%` : "Uploading…") : "Upload CSV"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </motion.div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-100">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading datasets…</div>
        )}

        {!loading && datasets.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 card p-10 text-center">
            <Database className="w-12 h-12 mx-auto text-[color:var(--muted)] mb-4" />
            <h2 className="text-xl font-bold">No datasets yet</h2>
            <p className="text-sm text-[color:var(--muted)] mt-2 mb-6">
              Upload a CSV to start analysing arbitrary data.
            </p>
            <button className="btn btn-primary" disabled={uploading} onClick={() => inputRef.current?.click()}>
              Upload CSV
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
    </div>
  );
}
