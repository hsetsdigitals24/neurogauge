"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { fetchDatasetById, type DatasetResponse } from "@/lib/analytics/client";
import { WorkbenchShell } from "@/components/workbench/WorkbenchShell";

export default function DatasetAnalyticsPage() {
  const { id } = useParams<{ id: string }>();

  const [dataset, setDataset] = useState<DatasetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    fetchDatasetById(id)
      .then((res) => { if (!cancelled) setDataset(res); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dataset"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[color:var(--muted)]">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Loading dataset workbench…</p>
        </div>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="px-6 md:px-10 pb-16 max-w-6xl mx-auto w-full">
        <div className="mt-6 flex items-center gap-2 text-sm">
          <Link href="/dashboard/datasets" className="text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to datasets
          </Link>
        </div>
        <div className="mt-8 card p-8 text-sm text-[color:var(--danger)]">
          {error ?? "Failed to load dataset."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-screen">
      {/* Breadcrumb header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[color:var(--border)] bg-white shrink-0">
        <Link
          href="/dashboard/datasets"
          className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Datasets
        </Link>
        <span className="text-[color:var(--muted)]">/</span>
        <span className="text-sm font-semibold">{dataset.name ?? "Dataset"}</span>
        <span className="ml-auto text-xs text-[color:var(--muted)] tabular-nums">
          {dataset.n.toLocaleString()} rows · {Object.keys(dataset.schema).length} variables
        </span>
      </div>

      {/* Workbench fills remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <WorkbenchShell
          source={{ kind: "dataset", datasetId: id }}
          sessions={[]}
          questions={[]}
          dataset={dataset}
        />
      </div>
    </div>
  );
}
