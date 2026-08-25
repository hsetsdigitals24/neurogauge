"use client";
import { use, useEffect, useState } from "react";
import { Award, Printer, CheckCircle2, XCircle } from "lucide-react";

interface Cert {
  valid: boolean;
  serial: string;
  issuedAt: string;
  holderName: string;
  courseTitle: string;
  level: string | null;
}

export default function CertificatePage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = use(params);
  const [cert, setCert] = useState<Cert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/training/certificates/${serial}`)
      .then((r) => r.json())
      .then((d) => setCert(d?.valid ? d : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serial]);

  if (loading) return <main className="max-w-2xl mx-auto px-6 py-20 text-center text-[color:var(--muted)]">Verifying…</main>;

  if (!cert) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <XCircle className="w-10 h-10 mx-auto text-rose-500" />
        <h1 className="text-xl font-bold mt-3">Certificate not found</h1>
        <p className="text-sm text-[color:var(--muted)] mt-1">No certificate matches serial <span className="font-mono">{serial}</span>.</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="no-print flex items-center justify-between mb-6">
        <span className="inline-flex items-center gap-1 text-emerald-700 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" /> Verified certificate
        </span>
        <button onClick={() => window.print()} className="btn btn-ghost btn-sm inline-flex items-center gap-1">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="border-4 border-indigo-200 rounded-2xl p-10 md:p-16 text-center bg-white">
        <Award className="w-14 h-14 mx-auto text-amber-500" />
        <p className="mt-4 text-sm uppercase tracking-[0.2em] text-[color:var(--muted)] font-bold">Certificate of Completion</p>
        <p className="mt-6 text-sm text-[color:var(--muted)]">This certifies that</p>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-2">{cert.holderName}</h1>
        <p className="mt-6 text-sm text-[color:var(--muted)]">has successfully completed</p>
        <h2 className="text-xl md:text-2xl font-bold mt-2">{cert.courseTitle}</h2>
        {cert.level && <p className="mt-1 text-sm text-[color:var(--muted)] capitalize">{cert.level} level</p>}
        <div className="mt-10 flex items-center justify-between text-sm text-[color:var(--muted)]">
          <div className="text-left">
            <div className="font-mono">{cert.serial}</div>
            <div className="text-xs">Verification serial</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{new Date(cert.issuedAt).toLocaleDateString()}</div>
            <div className="text-xs">Date issued</div>
          </div>
        </div>
        <p className="mt-8 text-xs text-[color:var(--muted)]">Issued by Neurogauge · verify at /certificates/{cert.serial}</p>
      </div>
    </main>
  );
}
