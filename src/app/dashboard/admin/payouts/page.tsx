"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notify } from "@/lib/toast";
import { formatNaira } from "@/lib/money";
import { AdminForbidden } from "@/components/admin/AdminForbidden";

interface Payout {
  id: string; amountKobo: number; status: string; note: string | null; createdAt: string;
  consultant: { headline: string; user: { name: string; email: string } };
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    return fetch("/api/admin/payouts")
      .then((r) => { if (r.status === 403) { setForbidden(true); return null; } return r.json(); })
      .then((d) => { if (d) setPayouts(d.payouts ?? []); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function toggle(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      if (!res.ok) { notify.error("Could not update"); return; }
      notify.success("Updated"); load();
    } finally { setBusy(null); }
  }

  if (forbidden) return <AdminForbidden />;

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/admin" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
        </div>
        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">Consultant payouts</h1>
        <p className="text-sm text-[color:var(--muted)] mt-1">Disburse earnings off-platform, then mark each entry paid.</p>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : payouts.length === 0 ? (
          <p className="mt-6 text-sm text-[color:var(--muted)]">No payouts recorded yet.</p>
        ) : (
          <div className="mt-6 card divide-y divide-[color:var(--border)]">
            {payouts.map((p) => (
              <div key={p.id} className="px-4 py-3 text-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.consultant.user.name}</div>
                  <div className="text-xs text-[color:var(--muted)]">{p.consultant.user.email} · {new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold">{formatNaira(p.amountKobo)}</span>
                  <span className={`text-[10px] uppercase font-bold rounded-full px-2 py-0.5 ${p.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{p.status}</span>
                  <button className="btn btn-ghost btn-sm" disabled={busy === p.id} onClick={() => toggle(p.id, p.status === "paid" ? "pending" : "paid")}>
                    {p.status === "paid" ? "Mark pending" : "Mark paid"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
