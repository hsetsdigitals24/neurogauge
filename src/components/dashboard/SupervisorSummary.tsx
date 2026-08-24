"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FolderKanban, Building2, Users, CheckCircle2, ArrowRight, MapPin,
} from "lucide-react";

interface Totals { projects: number; sites: number; participants: number; completed: number; }
interface DashboardData {
  totals: Totals;
  timeline: { date: string; count: number }[];
}

function pct(done: number, total: number) { return total === 0 ? 0 : Math.round((done / total) * 100); }

// Institution / research-group accounts see an at-a-glance rollup of their own
// projects + sites up front, backed by the account-scoped dashboard API. Links
// out to the full supervisor dashboard and sites.
export function SupervisorSummary({ accountType }: { accountType: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isInstitution = accountType === "institution";
  const maxDay = data ? Math.max(1, ...data.timeline.map((t) => t.count)) : 1;

  return (
    <section className="card p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <span className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)]">
            {isInstitution ? "Institution overview" : "Research group overview"}
          </span>
          <h2 className="text-xl font-extrabold">Collection at a glance</h2>
        </div>
        <Link
          href={`/dashboard/overview`}
          className="btn btn-ghost text-xs text-indigo-700 hover:bg-indigo-50 inline-flex items-center gap-1"
        >
          Full dashboard <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-[color:var(--muted)]">Loading overview…</div>
      ) : !data ? (
        <div className="mt-4 text-sm text-[color:var(--muted)]">Overview unavailable.</div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={FolderKanban} label="Projects" value={data.totals.projects} />
            <Stat icon={Building2} label="Sites" value={data.totals.sites} />
            <Stat icon={Users} label="Participants" value={data.totals.participants} />
            <Stat icon={CheckCircle2} label="Completed" value={data.totals.completed}
              sub={`${pct(data.totals.completed, data.totals.participants)}%`} />
          </div>

          <div className="mt-4 flex items-end gap-[3px] h-16">
            {data.timeline.map((t) => (
              <div key={t.date} className="flex-1">
                <div
                  className="bg-indigo-500/70 rounded-t"
                  style={{ height: `${Math.max(2, (t.count / maxDay) * 64)}px` }}
                  title={`${t.date}: ${t.count}`}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-3 flex-wrap">
            <Link href={`/dashboard/sites`}
              className="btn btn-ghost text-xs inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Manage sites
            </Link>
            <Link href={`/dashboard/overview`}
              className="btn btn-ghost text-xs inline-flex items-center gap-1">
              <FolderKanban className="w-3.5 h-3.5" /> Full dashboard
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: number; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[color:var(--border)] p-3">
      <div className="flex items-center gap-1.5 text-[color:var(--muted)]">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-0.5 text-xl font-extrabold">{value}</div>
      {sub && <div className="text-[11px] text-[color:var(--muted)]">{sub}</div>}
    </motion.div>
  );
}
