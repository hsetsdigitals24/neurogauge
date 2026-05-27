"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FolderOpen, Plus, Users, FlaskConical, LogOut, ChevronRight } from "lucide-react";

interface ProjectCard {
  id: string;
  name: string;
  shareToken: string;
  createdAt: string;
  updatedAt?: string;
  owner?: { name: string; email: string };
  _count: { sessions: number; collaborators: number };
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [owned, setOwned] = useState<ProjectCard[]>([]);
  const [collab, setCollab] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]).then(([meData, projData]) => {
      setUser(meData.user);
      setOwned(projData.owned ?? []);
      setCollab(projData.collaborating ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="min-h-screen">
    

      <main className="px-6 md:px-10 pb-20 max-w-6xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">
              Your <span className="gradient-text">projects</span>
            </h1>
            <p className="text-[color:var(--muted)] mt-1 text-sm">
              Projects you own or collaborate on appear here.
            </p>
          </div>
          <Link href="/dashboard/projects/new" className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New project
          </Link>
        </motion.div>

        {loading && (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading projects…</div>
        )}

        {!loading && owned.length === 0 && collab.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 card p-10 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-[color:var(--muted)] mb-4" />
            <h2 className="text-xl font-bold">No projects yet</h2>
            <p className="text-sm text-[color:var(--muted)] mt-2 mb-6">
              Create your first N-back study project to get started.
            </p>
            <Link href="/dashboard/projects/new" className="btn btn-primary">
              Create project
            </Link>
          </motion.div>
        )}

        {!loading && owned.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-[color:var(--primary)]" />
              My projects
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {owned.map((p, i) => (
                <ProjectCard key={p.id} project={p} isOwner delay={i * 0.04} />
              ))}
            </div>
          </section>
        )}

        {!loading && collab.length > 0 && (
          <section className="mt-8">
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

function ProjectCard({
  project, isOwner, delay,
}: { project: ProjectCard; isOwner: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Link href={`/dashboard/projects/${project.id}`} className="block card p-5 hover:shadow-lg transition-shadow group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base truncate">{project.name}</h3>
              {isOwner ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">Owner</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold border border-sky-100">Collaborator</span>
              )}
            </div>
            {project.owner && (
              <p className="text-xs text-[color:var(--muted)] mt-0.5">by {project.owner.name}</p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-[color:var(--muted)] group-hover:translate-x-0.5 transition-transform shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm text-[color:var(--muted)]">
          <span className="flex items-center gap-1">
            <FlaskConical className="w-4 h-4" />
            {project._count.sessions} sessions
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {project._count.collaborators} collaborators
          </span>
          <span className="ml-auto text-xs">
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
