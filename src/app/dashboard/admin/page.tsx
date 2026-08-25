"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, CalendarCheck, GraduationCap, Award, Wallet, ShieldCheck } from "lucide-react";
import { AdminForbidden } from "@/components/admin/AdminForbidden";

interface Overview {
  pendingConsultants: number;
  approvedConsultants: number;
  bookings: number;
  courses: number;
  publishedCourses: number;
  certificates: number;
  pendingPayouts: number;
}

export default function AdminHubPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => { if (r.status === 403) { setForbidden(true); return null; } return r.json(); })
      .then((d) => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  if (forbidden) return <AdminForbidden />;

  const cards = [
    { href: "/dashboard/admin/consultants", icon: Users, label: "Consultants", value: data ? `${data.pendingConsultants} pending · ${data.approvedConsultants} approved` : "—" },
    { href: "/dashboard/admin/bookings", icon: CalendarCheck, label: "Bookings", value: data ? `${data.bookings} total` : "—" },
    { href: "/dashboard/admin/payouts", icon: Wallet, label: "Payouts", value: data ? `${data.pendingPayouts} pending` : "—" },
    { href: "/dashboard/admin/courses", icon: GraduationCap, label: "Courses", value: data ? `${data.publishedCourses}/${data.courses} published` : "—" },
    { href: "/dashboard/admin/certificates", icon: Award, label: "Certificates", value: data ? `${data.certificates} issued` : "—" },
  ];

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)]">Admin</span>
            <h1 className="text-2xl md:text-3xl font-extrabold">Platform administration</h1>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="card p-6 hover:shadow-md transition flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <c.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">{c.label}</h3>
                <p className="text-sm text-[color:var(--muted)]">{loading ? "…" : c.value}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
