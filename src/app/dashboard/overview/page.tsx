"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, FolderKanban, Building2, Users, CheckCircle2, MapPin, Clock,
} from "lucide-react";

interface Totals { projects: number; sites: number; participants: number; completed: number; }
interface PerProject { id: string; name: string; kind: string; participants: number; completed: number; siteCount: number; lastActivity: string | null; createdAt: string; }
interface PerSite { id: string; name: string; code: string; location: string | null; principalInvestigator: string | null; participants: number; completed: number; projectCount: number; }
interface Recent { id: string; projectName: string | null; siteName: string | null; siteCode: string | null; completed: boolean; createdAt: string; }
interface DashboardData {
  totals: Totals;
  perProject: PerProject[];
  perSite: PerSite[];
  unassigned: number;
  timeline: { date: string; count: number }[];
  recent: Recent[];
}

function pct(done: number, total: number) { return total === 0 ? 0 : Math.round((done / total) * 100); }

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxDay = data ? Math.max(1, ...data.timeline.map((t) => t.count)) : 1;

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full">
        <div className="mt-6">
          <Link href="/dashboard" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>

        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">Supervisor dashboard</h1>
        <p className="text-[color:var(--muted)] text-sm mt-1">Collection rolled up across all your projects and sites.</p>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : !data ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Dashboard unavailable.</div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={FolderKanban} label="Projects" value={data.totals.projects} />
              <Stat icon={Building2} label="Sites" value={data.totals.sites} />
              <Stat icon={Users} label="Participants" value={data.totals.participants} />
              <Stat icon={CheckCircle2} label="Completed" value={data.totals.completed}
                sub={`${pct(data.totals.completed, data.totals.participants)}%`} />
            </div>

            <section className="mt-8 card p-5">
              <h2 className="font-bold">Last 30 days</h2>
              <div className="mt-4 flex items-end gap-[3px] h-20">
                {data.timeline.map((t) => (
                  <div key={t.date} className="flex-1">
                    <div className="bg-indigo-500/70 rounded-t" style={{ height: `${Math.max(2, (t.count / maxDay) * 80)}px` }} title={`${t.date}: ${t.count}`} />
                  </div>
                ))}
              </div>
            </section>

            {/* Per-project */}
            <section className="mt-8">
              <h2 className="text-lg font-bold mb-3">By project</h2>
              {data.perProject.length === 0 ? (
                <div className="card p-8 text-center text-[color:var(--muted)] text-sm">No projects yet.</div>
              ) : (
                <div className="card overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                        <th className="p-3 font-semibold">Project</th>
                        <th className="p-3 font-semibold">Type</th>
                        <th className="p-3 font-semibold">Participants</th>
                        <th className="p-3 font-semibold">Completion</th>
                        <th className="p-3 font-semibold">Sites</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.perProject.map((p) => (
                        <tr key={p.id} className="border-b border-[color:var(--border)] last:border-0">
                          <td className="p-3">
                            <Link href={`/dashboard/projects/${p.id}`} className="text-indigo-600 hover:underline">{p.name}</Link>
                          </td>
                          <td className="p-3 text-[color:var(--muted)]">{p.kind === "questionnaire" ? "Questionnaire" : "N-back"}</td>
                          <td className="p-3">{p.participants}</td>
                          <td className="p-3">{pct(p.completed, p.participants)}%</td>
                          <td className="p-3">{p.siteCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Per-site */}
            <section className="mt-8">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> By site</h2>
              {data.perSite.length === 0 ? (
                <div className="card p-8 text-center text-[color:var(--muted)] text-sm">
                  No sites yet. <Link href="/dashboard/sites" className="text-indigo-600 hover:underline">Add one</Link>.
                </div>
              ) : (
                <div className="card overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                        <th className="p-3 font-semibold">Site</th>
                        <th className="p-3 font-semibold">Participants</th>
                        <th className="p-3 font-semibold">Completion</th>
                        <th className="p-3 font-semibold">Projects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.perSite.map((s) => (
                        <tr key={s.id} className="border-b border-[color:var(--border)] last:border-0">
                          <td className="p-3">
                            <Link href={`/dashboard/sites/${s.id}`} className="text-indigo-600 hover:underline">{s.name}</Link>
                            <span className="text-[color:var(--muted)] ml-1">({s.code})</span>
                          </td>
                          <td className="p-3">{s.participants}</td>
                          <td className="p-3">{pct(s.completed, s.participants)}%</td>
                          <td className="p-3">{s.projectCount}</td>
                        </tr>
                      ))}
                      {data.unassigned > 0 && (
                        <tr className="border-b border-[color:var(--border)] last:border-0 text-[color:var(--muted)]">
                          <td className="p-3 italic">Unassigned</td>
                          <td className="p-3">{data.unassigned}</td>
                          <td className="p-3">—</td>
                          <td className="p-3">—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Recent activity */}
            <section className="mt-8">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Recent activity</h2>
              {data.recent.length === 0 ? (
                <div className="card p-8 text-center text-[color:var(--muted)] text-sm">No activity yet.</div>
              ) : (
                <div className="card divide-y divide-[color:var(--border)]">
                  {data.recent.map((r) => (
                    <div key={r.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{r.projectName ?? "Project"}</span>
                        {r.siteName && <span className="text-[color:var(--muted)]"> · {r.siteName}</span>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${r.completed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {r.completed ? "Completed" : "In progress"}
                        </span>
                        <span className="text-[color:var(--muted)] text-xs">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] p-3">
      <div className="flex items-center gap-1.5 text-[color:var(--muted)]">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-0.5 text-xl font-extrabold">{value}</div>
      {sub && <div className="text-[11px] text-[color:var(--muted)]">{sub}</div>}
    </div>
  );
}
