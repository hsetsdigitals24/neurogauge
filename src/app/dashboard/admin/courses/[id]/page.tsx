"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ExternalLink } from "lucide-react";
import { notify } from "@/lib/toast";
import { AdminForbidden } from "@/components/admin/AdminForbidden";

interface LessonDraft { title: string; contentMarkdown: string; videoUrl: string; durationMins: string }
interface ModuleDraft { title: string; lessons: LessonDraft[] }
interface QuizDraft { prompt: string; options: string[]; correctIndex: number }

export default function CourseEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("draft");

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("beginner");
  const [priceNaira, setPriceNaira] = useState("0");
  const [estimatedMinutes, setEstMin] = useState("");
  const [passThreshold, setPass] = useState("70");
  const [modules, setModules] = useState<ModuleDraft[]>([]);
  const [quiz, setQuiz] = useState<QuizDraft[]>([]);

  useEffect(() => {
    fetch(`/api/training/courses/${id}`)
      .then((r) => { if (r.status === 403) { setForbidden(true); return null; } return r.json(); })
      .then((d) => {
        if (!d?.course) return;
        const c = d.course;
        setSlug(c.slug); setStatus(c.status); setTitle(c.title); setSummary(c.summary);
        setDescription(c.description); setLevel(c.level); setPriceNaira(String(c.priceKobo / 100));
        setEstMin(c.estimatedMinutes?.toString() ?? ""); setPass(String(c.passThreshold ?? 70));
        setModules((c.modules ?? []).map((m: { title: string; lessons?: { title: string; contentMarkdown?: string; videoUrl?: string | null; durationMins?: number | null }[] }) => ({
          title: m.title,
          lessons: (m.lessons ?? []).map((l) => ({
            title: l.title, contentMarkdown: l.contentMarkdown ?? "", videoUrl: l.videoUrl ?? "", durationMins: l.durationMins?.toString() ?? "",
          })),
        })));
        setQuiz((c.quiz ?? []).map((q: { prompt: string; options?: unknown[]; correctIndex?: number }) => ({
          prompt: q.prompt, options: Array.isArray(q.options) ? q.options.map(String) : ["", ""], correctIndex: q.correctIndex ?? 0,
        })));
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function save(nextStatus?: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/training/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, summary, description, level,
          priceNaira: Number(priceNaira) || 0,
          estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
          passThreshold: Number(passThreshold) || 70,
          status: nextStatus ?? status,
          modules: modules.map((m) => ({
            title: m.title,
            lessons: m.lessons.map((l) => ({ title: l.title, contentMarkdown: l.contentMarkdown, videoUrl: l.videoUrl, durationMins: l.durationMins ? Number(l.durationMins) : null })),
          })),
          quiz: quiz.map((q) => ({ prompt: q.prompt, options: q.options, correctIndex: q.correctIndex })),
        }),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not save"); return; }
      if (nextStatus) setStatus(nextStatus);
      notify.success(nextStatus === "published" ? "Course published" : nextStatus === "draft" ? "Course unpublished" : "Saved");
    } finally { setSaving(false); }
  }

  // ── module/lesson/quiz mutators ──
  const addModule = () => setModules((m) => [...m, { title: "New module", lessons: [] }]);
  const updateModule = (mi: number, patch: Partial<ModuleDraft>) => setModules((m) => m.map((x, i) => i === mi ? { ...x, ...patch } : x));
  const removeModule = (mi: number) => setModules((m) => m.filter((_, i) => i !== mi));
  const addLesson = (mi: number) => setModules((m) => m.map((x, i) => i === mi ? { ...x, lessons: [...x.lessons, { title: "New lesson", contentMarkdown: "", videoUrl: "", durationMins: "" }] } : x));
  const updateLesson = (mi: number, li: number, patch: Partial<LessonDraft>) => setModules((m) => m.map((x, i) => i === mi ? { ...x, lessons: x.lessons.map((l, j) => j === li ? { ...l, ...patch } : l) } : x));
  const removeLesson = (mi: number, li: number) => setModules((m) => m.map((x, i) => i === mi ? { ...x, lessons: x.lessons.filter((_, j) => j !== li) } : x));

  const addQuiz = () => setQuiz((q) => [...q, { prompt: "", options: ["", ""], correctIndex: 0 }]);
  const updateQuiz = (qi: number, patch: Partial<QuizDraft>) => setQuiz((q) => q.map((x, i) => i === qi ? { ...x, ...patch } : x));
  const removeQuiz = (qi: number) => setQuiz((q) => q.filter((_, i) => i !== qi));
  const updateOption = (qi: number, oi: number, val: string) => setQuiz((q) => q.map((x, i) => i === qi ? { ...x, options: x.options.map((o, j) => j === oi ? val : o) } : x));
  const addOption = (qi: number) => setQuiz((q) => q.map((x, i) => i === qi ? { ...x, options: [...x.options, ""] } : x));
  const removeOption = (qi: number, oi: number) => setQuiz((q) => q.map((x, i) => i === qi ? { ...x, options: x.options.filter((_, j) => j !== oi), correctIndex: Math.min(x.correctIndex, x.options.length - 2) } : x));

  if (forbidden) return <AdminForbidden />;
  if (loading) return <div className="min-h-screen"><main className="px-6 md:px-10 pb-20 max-w-3xl mx-auto w-full"><div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div></main></div>;

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-3xl mx-auto w-full">
        <div className="mt-8 flex items-center justify-between">
          <Link href="/dashboard/admin/courses" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Courses
          </Link>
          <Link href={`/dashboard/training/${slug}`} className="text-sm text-indigo-600 inline-flex items-center gap-1" target="_blank">
            Preview <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-extrabold">Edit course</h1>
          <span className={`text-[10px] uppercase font-bold rounded-full px-2 py-0.5 ${status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100"}`}>{status}</span>
        </div>

        {/* Meta */}
        <div className="mt-6 card p-6 space-y-4">
          <div><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><label className="label">Summary</label><input className="input" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One-line pitch shown on cards" /></div>
          <div><label className="label">Description</label><textarea className="input min-h-[100px]" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid sm:grid-cols-4 gap-3">
            <div><label className="label">Level</label>
              <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
              </select>
            </div>
            <div><label className="label">Price (₦)</label><input className="input" type="number" min={0} value={priceNaira} onChange={(e) => setPriceNaira(e.target.value)} /></div>
            <div><label className="label">Est. minutes</label><input className="input" type="number" min={0} value={estimatedMinutes} onChange={(e) => setEstMin(e.target.value)} /></div>
            <div><label className="label">Pass %</label><input className="input" type="number" min={0} max={100} value={passThreshold} onChange={(e) => setPass(e.target.value)} /></div>
          </div>
        </div>

        {/* Curriculum */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="font-bold">Curriculum</h2>
          <button className="btn btn-ghost btn-sm inline-flex items-center gap-1" onClick={addModule}><Plus className="w-4 h-4" /> Module</button>
        </div>
        <div className="mt-3 space-y-4">
          {modules.map((m, mi) => (
            <div key={mi} className="card p-4">
              <div className="flex items-center gap-2">
                <input className="input flex-1 font-semibold" value={m.title} onChange={(e) => updateModule(mi, { title: e.target.value })} />
                <button className="btn btn-ghost btn-sm text-rose-600" onClick={() => removeModule(mi)}><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="mt-3 space-y-3 pl-3 border-l-2 border-[color:var(--border)]">
                {m.lessons.map((l, li) => (
                  <div key={li} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input className="input flex-1" placeholder="Lesson title" value={l.title} onChange={(e) => updateLesson(mi, li, { title: e.target.value })} />
                      <input className="input w-24" placeholder="min" type="number" value={l.durationMins} onChange={(e) => updateLesson(mi, li, { durationMins: e.target.value })} />
                      <button className="btn btn-ghost btn-sm text-rose-600" onClick={() => removeLesson(mi, li)}><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <input className="input" placeholder="Video URL (optional embed)" value={l.videoUrl} onChange={(e) => updateLesson(mi, li, { videoUrl: e.target.value })} />
                    <textarea className="input min-h-[80px]" placeholder="Lesson content…" value={l.contentMarkdown} onChange={(e) => updateLesson(mi, li, { contentMarkdown: e.target.value })} />
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm inline-flex items-center gap-1" onClick={() => addLesson(mi)}><Plus className="w-4 h-4" /> Lesson</button>
              </div>
            </div>
          ))}
          {modules.length === 0 && <p className="text-sm text-[color:var(--muted)]">No modules yet.</p>}
        </div>

        {/* Quiz */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="font-bold">Final quiz</h2>
          <button className="btn btn-ghost btn-sm inline-flex items-center gap-1" onClick={addQuiz}><Plus className="w-4 h-4" /> Question</button>
        </div>
        <div className="mt-3 space-y-4">
          {quiz.map((q, qi) => (
            <div key={qi} className="card p-4">
              <div className="flex items-center gap-2">
                <input className="input flex-1" placeholder={`Question ${qi + 1}`} value={q.prompt} onChange={(e) => updateQuiz(qi, { prompt: e.target.value })} />
                <button className="btn btn-ghost btn-sm text-rose-600" onClick={() => removeQuiz(qi)}><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="mt-2 space-y-1.5">
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type="radio" name={`correct-${qi}`} checked={q.correctIndex === oi} onChange={() => updateQuiz(qi, { correctIndex: oi })} title="Correct answer" />
                    <input className="input flex-1" placeholder={`Option ${oi + 1}`} value={o} onChange={(e) => updateOption(qi, oi, e.target.value)} />
                    {q.options.length > 2 && <button className="btn btn-ghost btn-sm text-rose-600" onClick={() => removeOption(qi, oi)}><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm inline-flex items-center gap-1" onClick={() => addOption(qi)}><Plus className="w-4 h-4" /> Option</button>
              </div>
              <p className="text-xs text-[color:var(--muted)] mt-2">Select the radio next to the correct answer.</p>
            </div>
          ))}
          {quiz.length === 0 && <p className="text-sm text-[color:var(--muted)]">No quiz questions — a course needs at least one to issue certificates.</p>}
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center gap-2 sticky bottom-4 bg-white/80 backdrop-blur p-3 rounded-xl border border-[color:var(--border)]">
          <button className="btn btn-primary" disabled={saving} onClick={() => save()}>{saving ? "Saving…" : "Save"}</button>
          {status === "published" ? (
            <button className="btn btn-ghost" disabled={saving} onClick={() => save("draft")}>Unpublish</button>
          ) : (
            <button className="btn btn-ghost text-emerald-700" disabled={saving} onClick={() => save("published")}>Save &amp; publish</button>
          )}
        </div>
      </main>
    </div>
  );
}
