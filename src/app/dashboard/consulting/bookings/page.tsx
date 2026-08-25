"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star, MessageSquare } from "lucide-react";
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
  meetingUrl: string | null;
  createdAt: string;
  consultant: { id: string; headline: string; user: { name: string } };
  review: { rating: number; comment: string | null } | null;
}

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-rose-50 text-rose-700",
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    return fetch("/api/marketplace/bookings?role=client")
      .then((r) => (r.ok ? r.json() : { asClient: [] }))
      .then((d) => setBookings(d.asClient ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function pay(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/marketplace/bookings/${id}/pay`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not start payment"); return; }
      window.location.assign(d.authorizationUrl);
    } catch {
      notify.error("Network error"); setBusy(null);
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/marketplace/bookings/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) { const d = await res.json(); notify.error(d.error ?? "Could not cancel"); return; }
      notify.success("Booking cancelled"); load();
    } catch {
      notify.error("Network error");
    } finally { setBusy(null); }
  }

  async function review(id: string, rating: number) {
    try {
      const res = await fetch(`/api/marketplace/bookings/${id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating }),
      });
      if (!res.ok) { const d = await res.json(); notify.error(d.error ?? "Could not save review"); return; }
      notify.success("Thanks for your review!"); load();
    } catch { notify.error("Network error"); }
  }

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-3xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/consulting" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> All consultants
          </Link>
        </div>
        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">My consulting bookings</h1>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : bookings.length === 0 ? (
          <div className="mt-6 card p-10 text-center">
            <h2 className="text-lg font-bold">No bookings yet</h2>
            <p className="text-sm text-[color:var(--muted)] mt-1">Find a consultant to get started.</p>
            <Link href="/dashboard/consulting" className="btn btn-primary mt-4 inline-flex">Browse consultants</Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {bookings.map((b) => (
              <div key={b.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold truncate">{b.topic}</h3>
                      <span className={`text-[10px] uppercase font-bold rounded-full px-2 py-0.5 ${STATUS_STYLE[b.status] ?? "bg-slate-100"}`}>{b.status}</span>
                    </div>
                    <p className="text-sm text-[color:var(--muted)] mt-0.5">
                      with {b.consultant.user.name} · {b.durationMins} min · {b.amountKobo != null ? formatNaira(b.amountKobo) : "—"}
                    </p>
                    {b.scheduledAt && <p className="text-xs text-[color:var(--muted)] mt-0.5">Scheduled: {new Date(b.scheduledAt).toLocaleString()}</p>}
                    {b.meetingUrl && <a href={b.meetingUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 mt-0.5 inline-block">Join meeting →</a>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {b.status === "confirmed" && (
                      <button className="btn btn-primary btn-sm" disabled={busy === b.id} onClick={() => pay(b.id)}>
                        {busy === b.id ? "…" : "Pay now"}
                      </button>
                    )}
                    {["requested", "confirmed"].includes(b.status) && (
                      <button className="btn btn-ghost btn-sm text-rose-600" disabled={busy === b.id} onClick={() => cancel(b.id)}>Cancel</button>
                    )}
                    <button className="btn btn-ghost btn-sm inline-flex items-center gap-1" onClick={() => setOpenThread(openThread === b.id ? null : b.id)}>
                      <MessageSquare className="w-4 h-4" /> Messages
                    </button>
                  </div>
                </div>

                {b.status === "completed" && (
                  <div className="mt-3 border-t border-[color:var(--border)] pt-3">
                    {b.review ? (
                      <div className="text-sm inline-flex items-center gap-1 text-amber-600">
                        Your rating:
                        {Array.from({ length: b.review.rating }).map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[color:var(--muted)]">Rate this session:</span>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => review(b.id, n)} className="text-amber-400 hover:scale-110 transition" title={`${n} star`}>
                            <Star className="w-5 h-5" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {openThread === b.id && <BookingThread bookingId={b.id} />}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
