"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, GraduationCap, Award, CheckCircle2 } from "lucide-react";
import { formatNaira } from "@/lib/money";

interface Course {
  id: string; slug: string; title: string; summary: string; coverImageUrl: string | null;
  level: string; priceKobo: number; estimatedMinutes: number | null;
  _count: { enrollments: number };
}
interface Enrollment {
  id: string; status: string;
  course: { slug: string; title: string; summary: string; level: string };
  certificate: { serial: string } | null;
}

export default function TrainingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/training/courses").then((r) => (r.ok ? r.json() : { courses: [] })),
      fetch("/api/training/enrollments").then((r) => (r.ok ? r.json() : { enrollments: [] })),
    ]).then(([c, e]) => { setCourses(c.courses ?? []); setEnrollments(e.enrollments ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const enrolledSlugs = new Set(enrollments.map((e) => e.course.slug));

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>

        <div className="mt-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)]">Training</span>
              <h1 className="text-2xl md:text-3xl font-extrabold">Research training &amp; certification</h1>
              <p className="text-sm text-[color:var(--muted)] mt-1">Learn research methods & statistics, earn a verifiable certificate.</p>
            </div>
          </div>
          <Link href="/dashboard/training/certificates" className="btn btn-ghost text-sm inline-flex items-center gap-1">
            <Award className="w-4 h-4" /> My certificates
          </Link>
        </div>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading courses…</div>
        ) : (
          <>
            {enrollments.length > 0 && (
              <>
                <h2 className="mt-8 font-bold">Continue learning</h2>
                <div className="mt-3 grid sm:grid-cols-2 gap-4">
                  {enrollments.map((e) => (
                    <Link key={e.id} href={`/dashboard/training/${e.course.slug}/learn`} className="card p-5 hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase rounded-full bg-slate-100 px-2 py-0.5">{e.course.level}</span>
                        {e.status === "completed" && <span className="text-emerald-600 inline-flex items-center gap-1 text-xs"><CheckCircle2 className="w-4 h-4" /> Completed</span>}
                      </div>
                      <h3 className="font-bold mt-2">{e.course.title}</h3>
                      <p className="text-sm text-[color:var(--muted)] mt-1 line-clamp-2">{e.course.summary}</p>
                      {e.certificate && <span className="text-xs text-indigo-600 mt-2 inline-block">Certificate: {e.certificate.serial}</span>}
                    </Link>
                  ))}
                </div>
              </>
            )}

            <h2 className="mt-8 font-bold">Course catalog</h2>
            {courses.length === 0 ? (
              <div className="mt-3 card p-10 text-center">
                <h3 className="text-lg font-bold">No courses published yet</h3>
                <p className="text-sm text-[color:var(--muted)] mt-1">Check back soon.</p>
              </div>
            ) : (
              <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((c) => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase rounded-full bg-slate-100 px-2 py-0.5">{c.level}</span>
                      {enrolledSlugs.has(c.slug) && <span className="text-[11px] text-emerald-600 font-semibold">Enrolled</span>}
                    </div>
                    <h3 className="font-bold mt-2">{c.title}</h3>
                    <p className="text-sm text-[color:var(--muted)] mt-1 line-clamp-3 flex-1">{c.summary}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-bold">{c.priceKobo === 0 ? "Free" : formatNaira(c.priceKobo)}</span>
                      <Link href={`/dashboard/training/${c.slug}`} className="btn btn-primary btn-sm">View course</Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
