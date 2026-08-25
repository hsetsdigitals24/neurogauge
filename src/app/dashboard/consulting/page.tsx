"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Briefcase, UserPlus, ClipboardList } from "lucide-react";
import { formatNaira } from "@/lib/money";

interface Consultant {
  id: string;
  name: string;
  headline: string;
  bio: string;
  expertise: string[];
  hourlyRateKobo: number;
  yearsExperience: number | null;
  avgRating: number | null;
  reviewCount: number;
}

export default function ConsultingPage() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/marketplace/consultants")
      .then((r) => (r.ok ? r.json() : { consultants: [] }))
      .then((d) => setConsultants(d.consultants ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = consultants.filter((c) => {
    if (!q.trim()) return true;
    const hay = `${c.name} ${c.headline} ${c.expertise.join(" ")}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>

        <div className="mt-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)]">Marketplace</span>
              <h1 className="text-2xl md:text-3xl font-extrabold">Statistical consulting</h1>
              <p className="text-sm text-[color:var(--muted)] mt-1">Book a session with a vetted statistics consultant.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/consulting/bookings" className="btn btn-ghost text-sm inline-flex items-center gap-1">
              <ClipboardList className="w-4 h-4" /> My bookings
            </Link>
            <Link href="/dashboard/consulting/apply" className="btn btn-primary text-sm inline-flex items-center gap-1">
              <UserPlus className="w-4 h-4" /> Become a consultant
            </Link>
          </div>
        </div>

        <input
          className="input mt-6"
          placeholder="Search by name, expertise (e.g. ANOVA, SEM, R)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading consultants…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 card p-10 text-center">
            <h2 className="text-lg font-bold">No consultants yet</h2>
            <p className="text-sm text-[color:var(--muted)] mt-1">Check back soon, or apply to become one.</p>
          </div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold truncate">{c.name}</h3>
                  {c.avgRating != null && (
                    <span className="inline-flex items-center gap-1 text-sm text-amber-600">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {c.avgRating.toFixed(1)}
                      <span className="text-[color:var(--muted)]">({c.reviewCount})</span>
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium mt-1">{c.headline}</p>
                <p className="text-sm text-[color:var(--muted)] mt-1 line-clamp-3">{c.bio}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.expertise.slice(0, 6).map((e) => (
                    <span key={e} className="text-[11px] rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">{e}</span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm"><span className="font-bold">{formatNaira(c.hourlyRateKobo)}</span> <span className="text-[color:var(--muted)]">/hour</span></span>
                  <Link href={`/dashboard/consulting/${c.id}`} className="btn btn-primary btn-sm">View &amp; book</Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
