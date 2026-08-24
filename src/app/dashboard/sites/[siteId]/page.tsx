"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, Users, CheckCircle2, FolderKanban } from "lucide-react";

interface Participant {
  id: string;
  email: string;
  age: string;
  handedness: string;
  education: string;
  projectId: string | null;
  projectName: string | null;
  completed: boolean;
  startedAt: string | null;
  createdAt: string;
}
interface SiteDetail {
  site: { id: string; name: string; code: string; location: string | null; principalInvestigator: string | null };
  totals: { participants: number; completed: number; projectCount: number };
  participants: Participant[];
}

export default function SiteDetailPage() {
  const params = useParams();
  const siteId = String(params.siteId);
  const [data, setData] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sites/${siteId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full">
        <div className="mt-6">
          <Link href="/dashboard/sites" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to sites
          </Link>
        </div>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : !data ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Site not found.</div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)]">{data.site.code}</span>
                <h1 className="text-2xl md:text-3xl font-extrabold">{data.site.name}</h1>
                {(data.site.location || data.site.principalInvestigator) && (
                  <p className="text-sm text-[color:var(--muted)]">
                    {[data.site.location, data.site.principalInvestigator].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat icon={Users} label="Participants" value={data.totals.participants} />
              <Stat icon={CheckCircle2} label="Completed" value={data.totals.completed} />
              <Stat icon={FolderKanban} label="Projects" value={data.totals.projectCount} />
            </div>

            <section className="mt-8">
              <h2 className="text-lg font-bold mb-3">Participants</h2>
              {data.participants.length === 0 ? (
                <div className="card p-10 text-center text-[color:var(--muted)] text-sm">No submissions collected at this site yet.</div>
              ) : (
                <div className="card overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                        <th className="p-3 font-semibold">Email</th>
                        <th className="p-3 font-semibold">Project</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.participants.map((p) => (
                        <tr key={p.id} className="border-b border-[color:var(--border)] last:border-0">
                          <td className="p-3 truncate max-w-[16rem]">{p.email || "—"}</td>
                          <td className="p-3">
                            {p.projectId ? (
                              <Link href={`/dashboard/projects/${p.projectId}`} className="text-indigo-600 hover:underline">
                                {p.projectName}
                              </Link>
                            ) : (p.projectName ?? "—")}
                          </td>
                          <td className="p-3">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${p.completed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {p.completed ? "Completed" : "In progress"}
                            </span>
                          </td>
                          <td className="p-3 text-[color:var(--muted)]">{new Date(p.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] p-3">
      <div className="flex items-center gap-1.5 text-[color:var(--muted)]">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-0.5 text-xl font-extrabold">{value}</div>
    </div>
  );
}
