"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notify } from "@/lib/toast";
import { formatNaira } from "@/lib/money";
import { AdminForbidden } from "@/components/admin/AdminForbidden";

interface Consultant {
  id: string; headline: string; bio: string; expertise: string[]; hourlyRateKobo: number;
  status: string; yearsExperience: number | null;
  user: { name: string; email: string }; _count: { bookings: number };
}

const NEXT: Record<string, { label: string; status: string; cls: string }[]> = {
  pending: [{ label: "Approve", status: "approved", cls: "btn-primary" }, { label: "Reject", status: "rejected", cls: "btn-ghost text-rose-600" }],
  approved: [{ label: "Suspend", status: "suspended", cls: "btn-ghost text-rose-600" }],
  rejected: [{ label: "Approve", status: "approved", cls: "btn-primary" }],
  suspended: [{ label: "Reinstate", status: "approved", cls: "btn-primary" }],
};

export default function AdminConsultantsPage() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    return fetch("/api/admin/consultants")
      .then((r) => { if (r.status === 403) { setForbidden(true); return null; } return r.json(); })
      .then((d) => { if (d) setConsultants(d.consultants ?? []); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/consultants", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      if (!res.ok) { notify.error("Could not update"); return; }
      notify.success("Updated"); load();
    } finally { setBusy(null); }
  }

  if (forbidden) return <AdminForbidden />;

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-3xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/admin" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
        </div>
        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">Consultant moderation</h1>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : consultants.length === 0 ? (
          <p className="mt-6 text-sm text-[color:var(--muted)]">No consultant applications yet.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {consultants.map((c) => (
              <div key={c.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold truncate">{c.user.name}</h3>
                      <span className="text-[10px] uppercase font-bold rounded-full px-2 py-0.5 bg-slate-100">{c.status}</span>
                    </div>
                    <p className="text-sm text-[color:var(--muted)]">{c.user.email}</p>
                    <p className="text-sm font-medium mt-1">{c.headline}</p>
                    <p className="text-sm text-[color:var(--muted)] mt-1">{c.bio}</p>
                    <p className="text-xs text-[color:var(--muted)] mt-2">{formatNaira(c.hourlyRateKobo)}/hr · {c._count.bookings} bookings · {c.expertise.join(", ")}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {(NEXT[c.status] ?? []).map((a) => (
                      <button key={a.status} className={`btn btn-sm ${a.cls}`} disabled={busy === c.id} onClick={() => setStatus(c.id, a.status)}>{a.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
