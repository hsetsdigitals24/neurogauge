"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { fetchDataset, type DatasetResponse } from "@/lib/analytics/client";
import type { CustomQuestion } from "@/lib/types";
import { WorkbenchShell } from "@/components/workbench/WorkbenchShell";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestSession = any;

export default function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();

  const [dataset, setDataset] = useState<DatasetResponse | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [projectName, setProjectName] = useState("Project");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const [datasetRes, sessionsRes, projectRes] = await Promise.all([
          fetchDataset(id),
          fetch(`/api/projects/${id}/sessions`),
          fetch(`/api/projects/${id}`),
        ]);

        if (!sessionsRes.ok || !projectRes.ok) throw new Error("Failed to load project data");

        const [sessionsData, projectData] = await Promise.all([
          sessionsRes.json(),
          projectRes.json(),
        ]);

        if (!cancelled) {
          setDataset(datasetRes);
          setSessions(Array.isArray(sessionsData) ? sessionsData : []);
          setQuestions(projectData.project?.config?.customQuestions ?? []);
          setProjectName(projectData.project?.name ?? "Project");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[color:var(--muted)]">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Loading analytics workbench…</p>
        </div>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="px-6 md:px-10 pb-16 max-w-6xl mx-auto w-full">
        <div className="mt-6 flex items-center gap-2 text-sm">
          <Link href={`/dashboard/projects/${id}`} className="text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to project
          </Link>
        </div>
        <div className="mt-8 card p-8 text-sm text-[color:var(--danger)]">
          {error ?? "Failed to load dataset."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Breadcrumb header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[color:var(--border)] bg-white shrink-0">
        <Link
          href={`/dashboard/projects/${id}`}
          className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          {projectName}
        </Link>
        <span className="text-[color:var(--muted)]">/</span>
        <span className="text-sm font-semibold">Analytics Workbench</span>
        <span className="ml-auto text-xs text-[color:var(--muted)] tabular-nums">
          {dataset.n.toLocaleString()} rows · {Object.keys(dataset.schema).length} variables
        </span>
      </div>

      {/* Workbench fills remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <WorkbenchShell
          projectId={id}
          sessions={sessions}
          questions={questions}
          dataset={dataset}
        />
      </div>
    </div>
  );
}
