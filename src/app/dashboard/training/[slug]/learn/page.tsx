"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Award, HelpCircle } from "lucide-react";
import { notify } from "@/lib/toast";

interface Lesson { id: string; title: string; contentMarkdown: string; videoUrl: string | null; durationMins: number | null }
interface Module { id: string; title: string; lessons: Lesson[] }
interface QuizQ { id: string; prompt: string; options: string[] }
interface Course { id: string; slug: string; title: string; modules: Module[]; quiz: QuizQ[] }
interface Enrollment { completedLessonIds: string[]; status: string; certificate: { serial: string } | null; lastAttempt: { score: number; passed: boolean } | null }

export default function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; certificate: { serial: string } | null } | null>(null);

  const flatLessons = useMemo(() => course?.modules.flatMap((m) => m.lessons) ?? [], [course]);

  function load() {
    return fetch(`/api/training/courses/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setCourse(d?.course ?? null);
        setEnrollment(d?.enrollment ?? null);
        const first = d?.course?.modules?.[0]?.lessons?.[0]?.id ?? null;
        setActiveLessonId((cur) => cur ?? first);
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const completed = new Set(enrollment?.completedLessonIds ?? []);
  const allDone = flatLessons.length > 0 && flatLessons.every((l) => completed.has(l.id));
  const activeLesson = flatLessons.find((l) => l.id === activeLessonId) ?? null;

  async function markComplete(lessonId: string) {
    try {
      const res = await fetch(`/api/training/lessons/${lessonId}/complete`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); notify.error(d.error ?? "Could not save"); return; }
      setEnrollment((e) => e ? { ...e, completedLessonIds: Array.from(new Set([...e.completedLessonIds, lessonId])) } : e);
    } catch { notify.error("Network error"); }
  }

  async function submitQuiz() {
    if (!course) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training/courses/${course.id}/quiz`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not submit"); return; }
      setResult(d);
      if (d.passed) notify.success(`Passed with ${d.score}%!`);
      else notify.warning(`Scored ${d.score}%. You need ${d.passThreshold}% to pass — try again.`);
      load();
    } catch { notify.error("Network error"); } finally { setSubmitting(false); }
  }

  if (loading) return <div className="min-h-screen"><main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full"><div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div></main></div>;
  if (!course) return <div className="min-h-screen"><main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full"><div className="mt-10 text-center">Course not found. <Link className="text-indigo-600" href="/dashboard/training">Back</Link></div></main></div>;
  if (!enrollment) return <div className="min-h-screen"><main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full"><div className="mt-10 text-center">You&apos;re not enrolled. <Link className="text-indigo-600" href={`/dashboard/training/${slug}`}>View course</Link></div></main></div>;

  const cert = enrollment.certificate ?? result?.certificate ?? null;

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/training" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> All courses
          </Link>
        </div>
        <h1 className="mt-6 text-2xl font-extrabold">{course.title}</h1>
        <div className="mt-1 text-sm text-[color:var(--muted)]">{completed.size}/{flatLessons.length} lessons complete</div>

        {cert && (
          <div className="mt-4 card p-4 bg-emerald-50 border-emerald-200 flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 text-emerald-800 font-semibold"><Award className="w-5 h-5" /> Certificate earned — {cert.serial}</span>
            <Link href={`/certificates/${cert.serial}`} className="btn btn-primary btn-sm">View certificate</Link>
          </div>
        )}

        <div className="mt-6 grid md:grid-cols-3 gap-6">
          {/* Sidebar */}
          <aside className="md:col-span-1">
            <div className="card p-3">
              {course.modules.map((m, mi) => (
                <div key={m.id} className="mb-2">
                  <div className="text-xs font-bold uppercase text-[color:var(--muted)] px-2 py-1">{mi + 1}. {m.title}</div>
                  {m.lessons.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => { setActiveLessonId(l.id); setShowQuiz(false); }}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 ${activeLessonId === l.id && !showQuiz ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"}`}
                    >
                      {completed.has(l.id) ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
                      <span className="truncate">{l.title}</span>
                    </button>
                  ))}
                </div>
              ))}
              {course.quiz.length > 0 && (
                <button
                  onClick={() => setShowQuiz(true)}
                  disabled={!allDone}
                  title={allDone ? "" : "Complete all lessons to unlock the quiz"}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 ${showQuiz ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"} disabled:opacity-40`}
                >
                  <HelpCircle className="w-4 h-4 shrink-0" /> Final quiz
                </button>
              )}
            </div>
          </aside>

          {/* Content */}
          <section className="md:col-span-2">
            {showQuiz ? (
              <div className="card p-6">
                <h2 className="text-lg font-bold">Final quiz</h2>
                <p className="text-sm text-[color:var(--muted)] mt-1">Answer all questions and submit to earn your certificate.</p>
                <div className="mt-4 space-y-5">
                  {course.quiz.map((q, qi) => (
                    <div key={q.id}>
                      <p className="font-medium text-sm">{qi + 1}. {q.prompt}</p>
                      <div className="mt-2 space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className={`flex items-center gap-2 text-sm rounded-md border px-3 py-2 cursor-pointer ${answers[q.id] === oi ? "border-indigo-400 bg-indigo-50" : "border-[color:var(--border)]"}`}>
                            <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {result && (
                  <div className={`mt-4 text-sm font-semibold ${result.passed ? "text-emerald-700" : "text-amber-700"}`}>
                    You scored {result.score}%. {result.passed ? "Passed 🎉" : "Not yet — review the lessons and retry."}
                  </div>
                )}
                <button className="btn btn-primary w-full mt-5" disabled={submitting || Object.keys(answers).length < course.quiz.length} onClick={submitQuiz}>
                  {submitting ? "Submitting…" : "Submit quiz"}
                </button>
              </div>
            ) : activeLesson ? (
              <div className="card p-6">
                <h2 className="text-lg font-bold">{activeLesson.title}</h2>
                {activeLesson.videoUrl && (
                  <div className="mt-3 aspect-video">
                    <iframe src={activeLesson.videoUrl} className="w-full h-full rounded-lg" allowFullScreen title={activeLesson.title} />
                  </div>
                )}
                <div className="mt-4 text-sm whitespace-pre-wrap leading-relaxed">{activeLesson.contentMarkdown}</div>
                <div className="mt-6 flex items-center justify-between">
                  {completed.has(activeLesson.id) ? (
                    <span className="text-emerald-600 inline-flex items-center gap-1 text-sm"><CheckCircle2 className="w-4 h-4" /> Completed</span>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => markComplete(activeLesson.id)}>Mark complete</button>
                  )}
                  {(() => {
                    const idx = flatLessons.findIndex((l) => l.id === activeLesson.id);
                    const next = flatLessons[idx + 1];
                    return next ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => setActiveLessonId(next.id)}>Next lesson →</button>
                    ) : allDone && course.quiz.length > 0 ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowQuiz(true)}>Go to quiz →</button>
                    ) : null;
                  })()}
                </div>
              </div>
            ) : (
              <div className="card p-6 text-sm text-[color:var(--muted)]">This course has no lessons yet.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
