"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Users, FolderOpen, MapPin, Briefcase, GraduationCap } from "lucide-react";
import { ProjectCard, type ProjectCardData } from "@/components/dashboard/ProjectCard";
import { PlanBadge, type Entitlements } from "@/components/dashboard/PlanBadge";
import { SupervisorSummary } from "@/components/dashboard/SupervisorSummary";

type AccountType = "student" | "institution" | "research_group";

const DASHBOARD_HEADING: Record<AccountType, { title: string; sub: string }> = {
  student: { title: "projects", sub: "Create studies, upload datasets, and analyse your results." },
  institution: { title: "institution", sub: "Monitor your studies, sites, and collection across the institution." },
  research_group: { title: "research group", sub: "Track your lab's projects, sites, and data collection." },
};

// Tolerate error/empty responses so the dashboard never hard-crashes on r.json().
async function safeJson(url: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url);
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default function DashboardPage() {
  const [owned, setOwned] = useState<ProjectCardData[]>([]);
  const [collab, setCollab] = useState<ProjectCardData[]>([]);
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      safeJson("/api/auth/me"),
      safeJson("/api/projects"),
    ]).then(([meData, projData]) => {
      const user = meData.user as { accountType?: AccountType } | undefined;
      if (user?.accountType) setAccountType(user.accountType);
      setEntitlements((meData.entitlements as Entitlements) ?? null);
      setOwned((projData.owned as ProjectCardData[]) ?? []);
      setCollab((projData.collaborating as ProjectCardData[]) ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const heading = DASHBOARD_HEADING[accountType];
  const showSupervisor = accountType !== "student";

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-6xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">
              Your <span className="gradient-text">{heading.title}</span>
            </h1>
            <p className="text-[color:var(--muted)] mt-1 text-sm">{heading.sub}</p>
          </div>
          {!loading && <PlanBadge entitlements={entitlements} />}
        </motion.div>

        {loading && (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        )}

        {/* Institution / research-group accounts get a supervisor rollup up front */}
        {!loading && showSupervisor && (
          <div className="mt-8">
            <SupervisorSummary accountType={accountType} />
          </div>
        )}

        {/* Actions */}
        {!loading && (
          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <Link href="/dashboard/projects/new" className="btn btn-primary inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New project
            </Link>
            <Link href="/dashboard/datasets" className="btn btn-ghost inline-flex items-center gap-1.5 border border-[color:var(--border)]">
              <FolderOpen className="w-4 h-4" /> Datasets
            </Link>
            {showSupervisor && (
              <Link href="/dashboard/sites" className="btn btn-ghost inline-flex items-center gap-1.5 border border-[color:var(--border)]">
                <MapPin className="w-4 h-4" /> Sites
              </Link>
            )}
            <Link href="/dashboard/consulting" className="btn btn-ghost inline-flex items-center gap-1.5 border border-[color:var(--border)]">
              <Briefcase className="w-4 h-4" /> Consulting
            </Link>
            <Link href="/dashboard/training" className="btn btn-ghost inline-flex items-center gap-1.5 border border-[color:var(--border)]">
              <GraduationCap className="w-4 h-4" /> Training
            </Link>
          </div>
        )}

        {/* Owned projects */}
        {!loading && (
          <section className="mt-8">
            <h2 className="text-lg font-bold mb-3">Your projects</h2>
            {owned.length === 0 ? (
              <div className="card p-10 text-center text-[color:var(--muted)]">
                <p className="text-sm">You haven&apos;t created any projects yet.</p>
                <Link href="/dashboard/projects/new" className="btn btn-primary mt-4 inline-flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Create your first project
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {owned.map((p, i) => (
                  <ProjectCard key={p.id} project={p} isOwner={true} delay={i * 0.04} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Shared with me — projects owned by others */}
        {!loading && collab.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-[color:var(--primary)]" />
              Shared with me
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {collab.map((p, i) => (
                <ProjectCard key={p.id} project={p} isOwner={false} delay={i * 0.04} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
