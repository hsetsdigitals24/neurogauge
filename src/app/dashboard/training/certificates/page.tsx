"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award } from "lucide-react";

interface Cert { serial: string; issuedAt: string; course: { title: string; slug: string; level: string } }

export default function MyCertificatesPage() {
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/training/certificates")
      .then((r) => (r.ok ? r.json() : { certificates: [] }))
      .then((d) => setCerts(d.certificates ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-3xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/training" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Training
          </Link>
        </div>
        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">My certificates</h1>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : certs.length === 0 ? (
          <div className="mt-6 card p-10 text-center">
            <Award className="w-8 h-8 mx-auto text-[color:var(--muted)]" />
            <h2 className="text-lg font-bold mt-2">No certificates yet</h2>
            <p className="text-sm text-[color:var(--muted)] mt-1">Complete a course and pass its quiz to earn one.</p>
            <Link href="/dashboard/training" className="btn btn-primary mt-4 inline-flex">Browse courses</Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {certs.map((c) => (
              <div key={c.serial} className="card p-5 flex items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 font-bold"><Award className="w-4 h-4 text-amber-500" /> {c.course.title}</div>
                  <p className="text-sm text-[color:var(--muted)] mt-0.5">Serial {c.serial} · issued {new Date(c.issuedAt).toLocaleDateString()}</p>
                </div>
                <Link href={`/certificates/${c.serial}`} className="btn btn-primary btn-sm">View</Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
