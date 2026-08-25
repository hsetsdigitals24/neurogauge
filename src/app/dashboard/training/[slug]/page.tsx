"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, BookOpen, HelpCircle } from "lucide-react";
import { notify } from "@/lib/toast";
import { formatNaira } from "@/lib/money";

interface Lesson { id: string; title: string; durationMins: number | null }
interface Module { id: string; title: string; lessons: Lesson[] }
interface Course {
  id: string; slug: string; title: string; summary: string; description: string;
  level: string; priceKobo: number; estimatedMinutes: number | null; status: string;
  modules: Module[]; quiz: { id: string }[];
}

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/training/courses/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setCourse(d?.course ?? null); setEnrolled(Boolean(d?.enrollment)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  async function enroll() {
    if (!course) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/training/courses/${course.id}/enroll`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not enroll"); return; }
      if (d.authorizationUrl) { window.location.assign(d.authorizationUrl); return; }
      notify.success("Enrolled!");
      router.push(`/dashboard/training/${course.slug}/learn`);
    } catch {
      notify.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="min-h-screen"><main className="px-6 md:px-10 pb-20 max-w-3xl mx-auto w-full"><div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div></main></div>;
  if (!course) return <div className="min-h-screen"><main className="px-6 md:px-10 pb-20 max-w-3xl mx-auto w-full"><div className="mt-10 text-center">Course not found. <Link className="text-indigo-600" href="/dashboard/training">Back</Link></div></main></div>;

  const lessonCount = course.modules.reduce((s, m) => s + m.lessons.length, 0);

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-3xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/training" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> All courses
          </Link>
        </div>

        <div className="mt-6">
          <span className="text-[11px] uppercase rounded-full bg-slate-100 px-2 py-0.5">{course.level}</span>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-2">{course.title}</h1>
          <p className="text-base text-[color:var(--muted)] mt-1">{course.summary}</p>
          <div className="mt-3 flex items-center gap-4 text-sm text-[color:var(--muted)]">
            <span className="inline-flex items-center gap-1"><BookOpen className="w-4 h-4" /> {lessonCount} lessons</span>
            {course.quiz.length > 0 && <span className="inline-flex items-center gap-1"><HelpCircle className="w-4 h-4" /> {course.quiz.length}-question quiz</span>}
            {course.estimatedMinutes && <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" /> ~{course.estimatedMinutes} min</span>}
          </div>
        </div>

        <div className="mt-6 card p-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-2xl font-extrabold">{course.priceKobo === 0 ? "Free" : formatNaira(course.priceKobo)}</div>
          {enrolled ? (
            <Link href={`/dashboard/training/${course.slug}/learn`} className="btn btn-primary">Continue learning</Link>
          ) : (
            <button className="btn btn-primary" disabled={busy} onClick={enroll}>
              {busy ? "…" : course.priceKobo === 0 ? "Enroll for free" : "Enroll now"}
            </button>
          )}
        </div>

        {course.description && (
          <div className="mt-8">
            <h2 className="font-bold">About this course</h2>
            <p className="text-sm mt-2 whitespace-pre-wrap">{course.description}</p>
          </div>
        )}

        <div className="mt-8">
          <h2 className="font-bold">Curriculum</h2>
          <div className="mt-3 space-y-4">
            {course.modules.map((m, i) => (
              <div key={m.id} className="card p-4">
                <h3 className="font-semibold">{i + 1}. {m.title}</h3>
                <ul className="mt-2 space-y-1">
                  {m.lessons.map((l) => (
                    <li key={l.id} className="text-sm text-[color:var(--muted)] flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5" /> {l.title}
                      {l.durationMins ? <span className="text-xs">· {l.durationMins} min</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
