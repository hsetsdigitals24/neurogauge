"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Info, Loader2, CreditCard } from "lucide-react";
import QuestionnaireBuilder from "@/components/questionnaire/QuestionnaireBuilder";
import { blankQuestion, normalizeQuestionKeys } from "@/lib/questionnaire";
import { notify } from "@/lib/toast";
import { BillingModal } from "@/components/billing/BillingModal";
import { useProjectCredits } from "@/lib/useProjectCredits";
import type { QItem, QuestionnaireConfig } from "@/lib/types";

const QUESTION_TYPES: { v: string; label: string }[] = [
  { v: "likert", label: "Likert scale" },
  { v: "single", label: "Single choice" },
  { v: "multi", label: "Multiple choice" },
  { v: "open", label: "Open-ended" },
  { v: "numeric", label: "Number" },
];

const TONES: { v: string; label: string }[] = [
  { v: "neutral", label: "Neutral / academic" },
  { v: "plain", label: "Plain language" },
  { v: "clinical", label: "Clinical" },
];

export default function AiQuestionnaireForm() {
  const router = useRouter();
  const backHref = "/dashboard/projects/new";

  const [name, setName] = useState("");
  const [construct, setConstruct] = useState("");
  const [audience, setAudience] = useState("");
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<string[]>(["likert"]);
  const [scalePoints, setScalePoints] = useState(5);
  const [tone, setTone] = useState("neutral");
  const [notes, setNotes] = useState("");

  const [questions, setQuestions] = useState<QItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [showBilling, setShowBilling] = useState(false);
  const { credits: projectCredits, refresh: refreshCredits } = useProjectCredits();

  function toggleType(v: string) {
    setTypes((t) => (t.includes(v) ? t.filter((x) => x !== v) : [...t, v]));
  }

  async function generate() {
    if (!construct.trim()) { notify.error("Describe what you want to measure first"); return; }
    setGenerating(true);
    setAiNotice(null);
    try {
      const res = await fetch("/api/ai/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ construct, audience, count, types, scalePoints, tone, notes }),
      });
      const data = await res.json();
      if (res.status === 503) {
        setAiNotice(data.error ?? "AI generation is not configured.");
        if (questions.length === 0) setQuestions([blankQuestion("likert")]);
        return;
      }
      if (!res.ok) { notify.error(data.error ?? "Generation failed"); return; }
      const fresh = data.questions as QItem[];
      // Append to (rather than replace) any questions already drafted, so
      // re-running generation grows the questionnaire instead of wiping it.
      setQuestions((prev) => [...prev, ...fresh]);
      notify.success(
        questions.length > 0
          ? `Added ${fresh.length} questions — review and edit below`
          : `Generated ${fresh.length} questions — review and edit below`
      );
    } catch {
      notify.error("Network error");
    } finally {
      setGenerating(false);
    }
  }

  function addManually() {
    setQuestions((q) => (q.length ? q : [blankQuestion("likert")]));
    setAiNotice(null);
  }

  async function create() {
    if (!name.trim()) { notify.error("Project name is required"); return; }
    const cleaned = questions.filter((q) => q.prompt.trim());
    if (cleaned.length === 0) { notify.error("Add at least one question with a prompt"); return; }

    const config: QuestionnaireConfig = {
      kind: "questionnaire",
      studyName: name.trim(),
      description: construct.trim() || undefined,
      questions: normalizeQuestionKeys(cleaned),
      meta: { construct: construct.trim() || undefined, audience: audience.trim() || undefined, tone },
    };

    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), config }),
      });
      const data = await res.json();
      if (res.status === 402) {
        notify.error(data.message ?? "You need a project credit to create this questionnaire");
        setShowBilling(true);
        return;
      }
      if (!res.ok) { notify.error(data.message ?? data.error ?? "Failed to create"); return; }
      notify.success("Questionnaire created");
      router.push(`/dashboard/projects/${data.id}`);
    } catch {
      notify.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-3xl mx-auto w-full">
        <div className="mt-6">
          <Link href={backHref} className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Project types
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-2 flex-wrap">
            <Sparkles className="w-8 h-8 text-[color:var(--primary)] shrink-0" />
            AI <span className="gradient-text">questionnaire</span>
          </h1>
          <p className="text-[color:var(--muted)] mt-1 text-sm">
            Describe what you want to measure. AI drafts a questionnaire you can review, edit, and share with participants — responses flow straight into the analytics workbench.
          </p>
        </motion.div>

        {projectCredits === 0 && (
          <div className="mt-6 card p-4 flex items-start gap-3 border border-amber-200 bg-amber-50">
            <CreditCard className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-amber-800">
              <span className="font-semibold">You have no project credits.</span>{" "}
              Creating a questionnaire uses one credit — buy a project pass to continue.
            </div>
            <button className="btn btn-primary btn-sm shrink-0" onClick={() => setShowBilling(true)}>
              Buy a project pass
            </button>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6 mt-6 space-y-5">
          <div>
            <label className="label">Project name</label>
            <input
              className="input mt-1"
              placeholder="e.g. Sleep Quality Survey"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">What do you want to measure?</label>
            <textarea
              className="textarea mt-1"
              rows={3}
              placeholder="e.g. Perceived sleep quality and daytime fatigue in university students over the past two weeks."
              value={construct}
              onChange={(e) => setConstruct(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Target audience</label>
              <input
                className="input mt-1"
                placeholder="e.g. Undergraduate students"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Number of questions</label>
              <input
                type="number"
                min={1}
                max={50}
                className="input mt-1"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value || "0"))}
              />
            </div>
          </div>

          <div>
            <label className="label">Question types</label>
            <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 mt-1">
              {QUESTION_TYPES.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => toggleType(t.v)}
                  className={`btn text-sm ${types.includes(t.v) ? "btn-primary" : "btn-ghost"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Likert scale points</label>
              <select
                className="select mt-1"
                value={scalePoints}
                onChange={(e) => setScalePoints(parseInt(e.target.value))}
                disabled={!types.includes("likert")}
              >
                {[3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>{n}-point</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tone</label>
              <select className="select mt-1" value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => (
                  <option key={t.v} value={t.v}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Additional guidance (optional)</label>
            <textarea
              className="textarea mt-1"
              rows={2}
              placeholder="e.g. Avoid double-barrelled items; include a couple of reverse-scored questions."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
              onClick={generate}
              disabled={generating}
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Sparkles className="w-4 h-4" /> {questions.length > 0 ? "Generate more" : "Generate questionnaire"}</>}
            </button>
            <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={addManually}>
              Build manually
            </button>
          </div>
        </motion.div>

        {aiNotice && (
          <div className="mt-4 card p-4 flex items-start gap-3 border-dashed">
            <Info className="w-5 h-5 text-[color:var(--muted)] shrink-0 mt-0.5" />
            <div className="text-sm text-[color:var(--muted)]">
              <span className="font-semibold text-[color:var(--fg)]">{aiNotice}</span>{" "}
              You can still build the questionnaire by hand below.
            </div>
          </div>
        )}

        {questions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Review questions</h2>
              <span className="text-sm text-[color:var(--muted)]">{questions.length} item(s)</span>
            </div>
            <QuestionnaireBuilder questions={questions} onChange={setQuestions} />
          </motion.div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
            onClick={create}
            disabled={saving || questions.length === 0}
          >
            {saving ? "Creating…" : "Create questionnaire →"}
          </button>
          <Link href={backHref} className="btn btn-ghost w-full sm:w-auto text-center">Cancel</Link>
        </div>
      </main>

      <BillingModal
        open={showBilling}
        focus="project"
        message="Creating a questionnaire uses one project credit. Buy a project pass below, then create your questionnaire."
        onClose={() => { setShowBilling(false); refreshCredits(); }}
      />
    </div>
  );
}
