"use client";
import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { notify } from "@/lib/toast";
import { formatNaira } from "@/lib/money";

interface Review { rating: number; comment: string | null; createdAt: string }
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
  reviews: Review[];
}

const DURATIONS = [30, 60, 90, 120];

export default function ConsultantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [c, setC] = useState<Consultant | null>(null);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [durationMins, setDurationMins] = useState(60);
  const [scheduledAt, setScheduledAt] = useState("");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    fetch(`/api/marketplace/consultants/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setC(d?.consultant ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function book() {
    if (!topic.trim()) { notify.error("Describe what you need help with."); return; }
    setBooking(true);
    try {
      const res = await fetch("/api/marketplace/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultantId: id, topic, message, durationMins, scheduledAt: scheduledAt || null }),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not create booking"); return; }
      notify.success("Booking requested — the consultant will confirm.");
      router.push("/dashboard/consulting/bookings");
    } catch {
      notify.error("Network error");
    } finally {
      setBooking(false);
    }
  }

  if (loading) return <div className="min-h-screen"><main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full"><div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div></main></div>;
  if (!c) return <div className="min-h-screen"><main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full"><div className="mt-10 text-center">Consultant not found. <Link className="text-indigo-600" href="/dashboard/consulting">Back</Link></div></main></div>;

  const estimate = Math.round((c.hourlyRateKobo * durationMins) / 60);

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/consulting" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> All consultants
          </Link>
        </div>

        <div className="mt-6 grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-2xl font-extrabold">{c.name}</h1>
              {c.avgRating != null && (
                <span className="inline-flex items-center gap-1 text-sm text-amber-600">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {c.avgRating.toFixed(1)} <span className="text-[color:var(--muted)]">({c.reviewCount})</span>
                </span>
              )}
            </div>
            <p className="text-base font-medium mt-1">{c.headline}</p>
            {c.yearsExperience != null && <p className="text-sm text-[color:var(--muted)] mt-1">{c.yearsExperience} years experience</p>}
            <p className="text-sm mt-4 whitespace-pre-wrap">{c.bio}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {c.expertise.map((e) => (
                <span key={e} className="text-[11px] rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">{e}</span>
              ))}
            </div>

            {c.reviews.length > 0 && (
              <div className="mt-8">
                <h2 className="font-bold">Reviews</h2>
                <div className="mt-3 space-y-3">
                  {c.reviews.map((r, i) => (
                    <div key={i} className="card p-4">
                      <div className="inline-flex items-center gap-1 text-amber-600 text-sm">
                        {Array.from({ length: r.rating }).map((_, j) => <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                      </div>
                      {r.comment && <p className="text-sm mt-1">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <div className="card p-6 sticky top-24">
              <div className="text-sm"><span className="text-2xl font-extrabold">{formatNaira(c.hourlyRateKobo)}</span> <span className="text-[color:var(--muted)]">/hour</span></div>
              <label className="label mt-4">What do you need help with?</label>
              <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Choosing a test for my repeated-measures data" />
              <label className="label mt-3">Details (optional)</label>
              <textarea className="input min-h-[80px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Context, your variables, deadlines…" />
              <label className="label mt-3">Duration</label>
              <select className="input" value={durationMins} onChange={(e) => setDurationMins(Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </select>
              <label className="label mt-3">Preferred time (optional)</label>
              <input type="datetime-local" className="input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-[color:var(--muted)]">Estimated cost</span>
                <span className="font-bold">{formatNaira(estimate)}</span>
              </div>
              <button className="btn btn-primary w-full mt-4" disabled={booking} onClick={book}>
                {booking ? "Requesting…" : "Request booking"}
              </button>
              <p className="text-[11px] text-[color:var(--muted)] mt-2">You&apos;ll pay after the consultant confirms.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
