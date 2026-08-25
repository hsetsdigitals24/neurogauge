"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { AdminForbidden } from "@/components/admin/AdminForbidden";

interface Booking {
  id: string; status: string; topic: string; amountKobo: number | null; createdAt: string;
  client: { name: string; email: string };
  consultant: { headline: string; user: { name: string } };
  review: { rating: number } | null;
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/bookings")
      .then((r) => { if (r.status === 403) { setForbidden(true); return null; } return r.json(); })
      .then((d) => { if (d) setBookings(d.bookings ?? []); })
      .finally(() => setLoading(false));
  }, []);

  if (forbidden) return <AdminForbidden />;

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/admin" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
        </div>
        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">All bookings</h1>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : bookings.length === 0 ? (
          <p className="mt-6 text-sm text-[color:var(--muted)]">No bookings yet.</p>
        ) : (
          <div className="mt-6 card divide-y divide-[color:var(--border)]">
            {bookings.map((b) => (
              <div key={b.id} className="px-4 py-3 text-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{b.topic}</div>
                  <div className="text-xs text-[color:var(--muted)]">{b.client.name} → {b.consultant.user.name} · {new Date(b.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {b.amountKobo != null && <span>{formatNaira(b.amountKobo)}</span>}
                  <span className="text-[10px] uppercase font-bold rounded-full px-2 py-0.5 bg-slate-100">{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
