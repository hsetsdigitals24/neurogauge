"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, Plus, Users, FolderOpen, ArrowLeft } from "lucide-react";
import { notify } from "@/lib/toast";

interface InstitutionRow {
  id: string;
  name: string;
  code: string;
  role: "owner" | "admin" | "member";
  memberCount: number;
  projectCount: number;
}

const ROLE_LABEL: Record<InstitutionRow["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export default function InstitutionsPage() {
  const [rows, setRows] = useState<InstitutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/institutions");
      const data = await res.json();
      setRows(data.institutions ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error(data.error ?? "Could not create institution");
        return;
      }
      notify.success("Institution created");
      setName("");
      setCode("");
      setRows((r) => [...r, data.institution]);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full">
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <h1 className="text-3xl md:text-4xl font-extrabold">
            Collaborating <span className="gradient-text">institutions</span>
          </h1>
          <p className="text-[color:var(--muted)] mt-1 text-sm">
            Create an institution, invite colleagues to sign in, and see the multicenter
            studies you co-work on — scoped to your own site&apos;s data.
          </p>
        </motion.div>

        {/* Create */}
        <form onSubmit={create} className="card p-5 mt-8">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[color:var(--primary)]" /> New institution
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[color:var(--muted)]">Name</label>
              <input
                className="input mt-1 w-full"
                placeholder="e.g. Lagos Teaching Hospital"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[color:var(--muted)]">Code (optional)</label>
              <input
                className="input mt-1 w-full"
                placeholder="auto-generated from name"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <p className="text-[11px] text-[color:var(--muted)] mt-1">
                Share this code with a study lead so they can link you to their project.
              </p>
            </div>
          </div>
          <button className="btn btn-primary mt-4" disabled={creating || !name.trim()}>
            {creating ? "Creating…" : "Create institution"}
          </button>
        </form>

        {/* List */}
        <section className="mt-10">
          <h2 className="text-lg font-bold mb-3">Your institutions</h2>
          {loading ? (
            <div className="text-center text-[color:var(--muted)] text-sm py-8">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="card p-10 text-center text-[color:var(--muted)]">
              <Building2 className="w-8 h-8 mx-auto mb-3 opacity-60" />
              <p className="text-sm">You&apos;re not part of any institution yet.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {rows.map((inst, i) => (
                <motion.div
                  key={inst.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    href={`/dashboard/institutions/${inst.id}`}
                    className="card p-5 block hover:border-[color:var(--primary)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-bold">{inst.name}</h3>
                          <p className="text-xs text-[color:var(--muted)]">
                            code: <span className="font-mono">{inst.code}</span>
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[color:var(--muted)]/10 text-[color:var(--muted)] shrink-0">
                        {ROLE_LABEL[inst.role]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-4 text-xs text-[color:var(--muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {inst.memberCount} member
                        {inst.memberCount === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FolderOpen className="w-3.5 h-3.5" /> {inst.projectCount} project
                        {inst.projectCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
