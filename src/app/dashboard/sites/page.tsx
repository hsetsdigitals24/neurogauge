"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Plus, Trash2, Users, ChevronRight } from "lucide-react";
import { notify } from "@/lib/toast";

interface Site {
  id: string;
  name: string;
  code: string;
  location: string | null;
  principalInvestigator: string | null;
  sessionCount: number;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [pi, setPi] = useState("");

  function load() {
    return fetch("/api/sites")
      .then((r) => (r.ok ? r.json() : { sites: [] }))
      .then((d) => setSites((d.sites as Site[]) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) { notify.error("Site name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code: code.trim() || undefined, location, principalInvestigator: pi }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { notify.error(data.error ?? "Failed to create site"); return; }
      notify.success("Site created");
      setName(""); setCode(""); setLocation(""); setPi("");
      await load();
    } catch {
      notify.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(site: Site) {
    if (!confirm(`Delete site "${site.name}"? Its sessions are kept but become unassigned.`)) return;
    const res = await fetch(`/api/sites/${site.id}`, { method: "DELETE" });
    if (!res.ok) { notify.error("Failed to delete"); return; }
    notify.success("Site deleted");
    await load();
  }

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full">
        <div className="mt-6">
          <Link href="/dashboard" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)]">Multicenter</span>
            <h1 className="text-2xl md:text-3xl font-extrabold">Collection sites</h1>
          </div>
        </div>

        {/* Add site */}
        <section className="mt-6 card p-5">
          <h2 className="font-bold">Add a site</h2>
          <p className="text-sm text-[color:var(--muted)] mt-0.5">
            Each site gets a code used in per-site collection links (<code>?site=code</code>). Codes are slugified and can&apos;t change once set.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <div>
              <label className="label">Name</label>
              <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. University of X" />
            </div>
            <div>
              <label className="label">Code <span className="font-normal text-[color:var(--muted)]">(optional)</span></label>
              <input className="input mt-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="auto from name" />
            </div>
            <div>
              <label className="label">Location <span className="font-normal text-[color:var(--muted)]">(optional)</span></label>
              <input className="input mt-1" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <label className="label">Principal investigator <span className="font-normal text-[color:var(--muted)]">(optional)</span></label>
              <input className="input mt-1" value={pi} onChange={(e) => setPi(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary mt-4 inline-flex items-center gap-1.5" onClick={create} disabled={saving}>
            <Plus className="w-4 h-4" /> {saving ? "Adding…" : "Add site"}
          </button>
        </section>

        {/* Sites list */}
        <section className="mt-8">
          {loading ? (
            <div className="text-center text-[color:var(--muted)] text-sm">Loading sites…</div>
          ) : sites.length === 0 ? (
            <div className="card p-10 text-center text-[color:var(--muted)] text-sm">No sites yet.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {sites.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className="card p-5 h-full flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/dashboard/sites/${s.id}`} className="flex-1 min-w-0 group">
                        <h3 className="font-bold truncate inline-flex items-center gap-1">
                          {s.name}
                          <ChevronRight className="w-4 h-4 text-[color:var(--muted)] group-hover:translate-x-0.5 transition-transform" />
                        </h3>
                        <p className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)] mt-0.5">{s.code}</p>
                      </Link>
                      <button onClick={() => remove(s)} className="text-[color:var(--muted)] hover:text-[color:var(--danger)] p-1" title="Delete site">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {(s.location || s.principalInvestigator) && (
                      <p className="text-xs text-[color:var(--muted)] mt-2">
                        {[s.location, s.principalInvestigator].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-4 text-sm text-[color:var(--muted)]">
                      <Users className="w-4 h-4" /> {s.sessionCount} {s.sessionCount === 1 ? "participant" : "participants"}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
