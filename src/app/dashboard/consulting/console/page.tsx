"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Wallet } from "lucide-react";
import { notify } from "@/lib/toast";
import { formatNaira } from "@/lib/money";
import { BookingThread } from "@/components/consulting/BookingThread";

interface Booking {
  id: string;
  status: string;
  topic: string;
  message: string | null;
  durationMins: number;
  scheduledAt: string | null;
  amountKobo: number | null;
  consultantEarningsKobo: number | null;
  meetingUrl: string | null;
  client: { name: string; email: string };
}
interface Payout { id: string; amountKobo: number; status: string; note: string | null; createdAt: string }

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-rose-50 text-rose-700",
};

export default function ConsultantConsolePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isConsultant, setIsConsultant] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [pendingKobo, setPending] = useState(0);
  const [paidKobo, setPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    return Promise.all([
      fetch("/api/marketplace/bookings?role=consultant").then((r) => (r.ok ? r.json() : { asConsultant: [], isConsultant: false })),
      fetch("/api/marketplace/payouts").then((r) => (r.ok ? r.json() : { payouts: [] })),
    ]).then(([b, p]) => {
      setBookings(b.asConsultant ?? []);
      setIsConsultant(b.isConsultant ?? false);
      setPayouts(p.payouts ?? []);
      setPending(p.pendingKobo ?? 0);
      setPaid(p.paidKobo ?? 0);
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, action: string, extra?: Record<string, unknown>) {
    setBusy(id);
    try {
      const res = await fetch(`/api/marketplace/bookings/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) { const d = await res.json(); notify.error(d.error ?? "Could not update"); return; }
      notify.success("Updated"); load();
    } catch { notify.error("Network error"); } finally { setBusy(null); }
  }

  function confirm(id: string) {
    const meetingUrl = window.prompt("Optional meeting link (Zoom/Meet) — leave blank to skip:") ?? "";
    act(id, "confirm", { meetingUrl });
  }

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-3xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/consulting" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Marketplace
          </Link>
        </div>
        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">Consultant console</h1>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : !isConsultant ? (
          <div className="mt-6 card p-10 text-center">
            <h2 className="text-lg font-bold">You&apos;re not a consultant yet</h2>
            <p className="text-sm text-[color:var(--muted)] mt-1">Apply to start receiving bookings.</p>
            <Link href="/dashboard/consulting/apply" className="btn btn-primary mt-4 inline-flex">Become a consultant</Link>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1"><Wallet className="w-4 h-4" /> Pending earnings</div>
                <div className="text-2xl font-extrabold mt-1">{formatNaira(pendingKobo)}</div>
              </div>
              <div className="card p-5">
                <div className="text-xs text-[color:var(--muted)]">Paid out</div>
                <div className="text-2xl font-extrabold mt-1">{formatNaira(paidKobo)}</div>
              </div>
            </div>

            <h2 className="mt-8 font-bold">Incoming bookings</h2>
            {bookings.length === 0 ? (
              <p className="mt-3 text-sm text-[color:var(--muted)]">No bookings yet.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {bookings.map((b) => (
                  <div key={b.id} className="card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold truncate">{b.topic}</h3>
                          <span className={`text-[10px] uppercase font-bold rounded-full px-2 py-0.5 ${STATUS_STYLE[b.status] ?? "bg-slate-100"}`}>{b.status}</span>
                        </div>
                        <p className="text-sm text-[color:var(--muted)] mt-0.5">{b.client.name} · {b.durationMins} min · {b.amountKobo != null ? formatNaira(b.amountKobo) : "—"}</p>
                        {b.message && <p className="text-sm mt-1">{b.message}</p>}
                        {b.status === "paid" && b.consultantEarningsKobo != null && (
                          <p className="text-xs text-emerald-700 mt-1">You earn {formatNaira(b.consultantEarningsKobo)} on completion.</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {b.status === "requested" && <button className="btn btn-primary btn-sm" disabled={busy === b.id} onClick={() => confirm(b.id)}>Confirm</button>}
                        {["confirmed", "paid"].includes(b.status) && <button className="btn btn-primary btn-sm" disabled={busy === b.id} onClick={() => act(b.id, "complete")}>Mark completed</button>}
                        {["requested", "confirmed"].includes(b.status) && <button className="btn btn-ghost btn-sm text-rose-600" disabled={busy === b.id} onClick={() => act(b.id, "cancel")}>Decline</button>}
                        <button className="btn btn-ghost btn-sm inline-flex items-center gap-1" onClick={() => setOpenThread(openThread === b.id ? null : b.id)}>
                          <MessageSquare className="w-4 h-4" /> Messages
                        </button>
                      </div>
                    </div>
                    {openThread === b.id && <BookingThread bookingId={b.id} />}
                  </div>
                ))}
              </div>
            )}

            <h2 className="mt-8 font-bold">Payout ledger</h2>
            {payouts.length === 0 ? (
              <p className="mt-3 text-sm text-[color:var(--muted)]">No earnings recorded yet.</p>
            ) : (
              <div className="mt-3 card divide-y divide-[color:var(--border)]">
                {payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                    <span className="font-semibold">{formatNaira(p.amountKobo)}</span>
                    <span className={`text-[10px] uppercase font-bold rounded-full px-2 py-0.5 ${p.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
