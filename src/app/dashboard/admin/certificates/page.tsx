"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminForbidden } from "@/components/admin/AdminForbidden";

interface Cert {
  serial: string; issuedAt: string;
  user: { name: string; email: string };
  course: { title: string };
}

export default function AdminCertificatesPage() {
  const [certs, setCerts] = useState<Cert[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/certificates")
      .then((r) => { if (r.status === 403) { setForbidden(true); return null; } return r.json(); })
      .then((d) => { if (d) setCerts(d.certificates ?? []); })
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
        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">Issued certificates</h1>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : certs.length === 0 ? (
          <p className="mt-6 text-sm text-[color:var(--muted)]">No certificates issued yet.</p>
        ) : (
          <div className="mt-6 card divide-y divide-[color:var(--border)]">
            {certs.map((c) => (
              <div key={c.serial} className="px-4 py-3 text-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.course.title}</div>
                  <div className="text-xs text-[color:var(--muted)]">{c.user.name} · {c.user.email}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link href={`/certificates/${c.serial}`} className="font-mono text-xs text-indigo-600">{c.serial}</Link>
                  <span className="text-xs text-[color:var(--muted)]">{new Date(c.issuedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
