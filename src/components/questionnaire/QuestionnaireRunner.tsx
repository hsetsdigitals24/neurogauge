"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { QItem, QuestionnaireConfig } from "@/lib/types";

type Step = "consent" | "email" | "questions" | "done";

/** Answer value: string for open/single/likert/numeric; string[] for multi. */
type AnswerMap = Record<string, string | string[]>;

export default function QuestionnaireRunner({
  shareToken,
  projectName,
  config,
  siteCode,
}: {
  shareToken: string;
  projectName: string;
  config: QuestionnaireConfig;
  siteCode?: string; // per-site (multicenter) collection link
}) {
  const questions = config.questions ?? [];
  const [step, setStep] = useState<Step>("consent");
  const [consented, setConsented] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [participantId] = useState(() => "P-" + Math.random().toString(36).slice(2, 8).toUpperCase());
  const [startedAt] = useState(() => Date.now());
  const submitGuard = useRef(false);
  const [clientSubmissionId] = useState(() =>
    (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `csid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  function setAnswer(id: string, v: string | string[]) {
    setAnswers((a) => ({ ...a, [id]: v }));
    setErrors((e) => {
      if (!(id in e)) return e;
      const rest = { ...e };
      delete rest[id];
      return rest;
    });
  }

  function toggleMulti(id: string, option: string) {
    const cur = (answers[id] as string[] | undefined) ?? [];
    setAnswer(id, cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option]);
  }

  function validateEmail() {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { setEmailError("Valid email required"); return false; }
    setEmailError(null);
    return true;
  }

  function validateQuestions() {
    const e: Record<string, string> = {};
    for (const q of questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
      if (empty) e[q.id] = "This question is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validateQuestions()) return;
    if (submitGuard.current) return;
    submitGuard.current = true;
    setStep("done");
    setSaveStatus("saving");
    // Normalise multi answers to a joined string for storage/analysis.
    const stored: Record<string, string> = {};
    for (const q of questions) {
      const v = answers[q.id];
      if (v == null) continue;
      stored[q.id] = Array.isArray(v) ? v.join("; ") : String(v);
    }
    try {
      const res = await fetch(`/api/public/${shareToken}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          takerEmail: email,
          consentGiven: consented,
          answers: stored,
          startedAt,
          finishedAt: Date.now(),
          clientSubmissionId,
          siteCode,
        }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
      if (!res.ok) submitGuard.current = false;
    } catch {
      setSaveStatus("error");
      submitGuard.current = false;
    }
  }

  return (
    <main className="min-h-screen px-6 md:px-10 pb-16 w-full">
      <div className="max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="mt-8"
          >
            {step === "consent" && (
              <div className="card p-8">
                <h2 className="text-3xl font-extrabold">Informed <span className="gradient-text">consent</span></h2>
                <p className="text-sm text-[color:var(--muted)] mt-1 mb-6">Study: <strong>{projectName}</strong></p>
                <div className="text-sm space-y-3 leading-relaxed">
                  {config.consentText
                    ? <p>{config.consentText}</p>
                    : <>
                        <p>You are invited to take part in a research questionnaire. It involves answering a short set of questions about the topic below.</p>
                        <p><strong>What we collect:</strong> your email address (used only to identify your response) and your answers.</p>
                        <p><strong>Voluntary participation:</strong> participation is voluntary and you may stop at any time.</p>
                      </>}
                  {config.description && <p className="text-[color:var(--muted)]"><strong>About this study:</strong> {config.description}</p>}
                </div>
                <label className="flex items-start gap-3 mt-6 cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
                  <span className="text-sm">I have read the above and voluntarily agree to participate.</span>
                </label>
                <div className="mt-6">
                  <button className="btn btn-primary" disabled={!consented} onClick={() => setStep("email")}>
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {step === "email" && (
              <div className="card p-8">
                <h2 className="text-2xl font-extrabold mb-1">Your <span className="gradient-text">email</span></h2>
                <p className="text-sm text-[color:var(--muted)] mb-6">Used only to identify your response.</p>
                <label className="label">Email address <span className="text-[color:var(--danger)]">*</span></label>
                <input className="input" type="email" autoComplete="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                {emailError && <p className="text-xs text-[color:var(--danger)] mt-1">{emailError}</p>}
                <div className="mt-6 flex gap-3">
                  <button className="btn btn-ghost" onClick={() => setStep("consent")}>Back</button>
                  <button className="btn btn-primary" onClick={() => { if (validateEmail()) setStep("questions"); }}>
                    Start questionnaire →
                  </button>
                </div>
              </div>
            )}

            {step === "questions" && (
              <div className="card p-8">
                <h2 className="text-2xl font-extrabold mb-1">{projectName}</h2>
                <p className="text-sm text-[color:var(--muted)] mb-6">Please answer the questions below.</p>
                <div className="space-y-7">
                  {questions.map((q, i) => (
                    <QuestionField
                      key={q.id}
                      index={i + 1}
                      q={q}
                      value={answers[q.id]}
                      error={errors[q.id]}
                      onChange={(v) => setAnswer(q.id, v)}
                      onToggleMulti={(opt) => toggleMulti(q.id, opt)}
                    />
                  ))}
                </div>
                <div className="mt-8 flex gap-3">
                  <button className="btn btn-ghost" onClick={() => setStep("email")}>Back</button>
                  <button className="btn btn-primary" onClick={submit}>Submit →</button>
                </div>
              </div>
            )}

            {step === "done" && (
              <div className="card p-8 text-center">
                <h2 className="text-3xl font-extrabold">Thank you <span className="gradient-text">✨</span></h2>
                <p className="text-sm text-[color:var(--muted)] mt-2">Your response has been recorded.</p>
                <div className="mt-4">
                  {saveStatus === "saving" && <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">Saving…</span>}
                  {saveStatus === "saved" && <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">✓ Response saved</span>}
                  {saveStatus === "error" && <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">Save failed — please try again</span>}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function QuestionField({ index, q, value, error, onChange, onToggleMulti }: {
  index: number;
  q: QItem;
  value: string | string[] | undefined;
  error?: string;
  onChange: (v: string) => void;
  onToggleMulti: (option: string) => void;
}) {
  const points = q.scalePoints ?? 5;
  return (
    <div>
      <label className="label">
        <span className="text-[color:var(--muted)] mr-1">{index}.</span>
        {q.prompt || "(no prompt)"}
        {q.required && <span className="text-[color:var(--danger)] ml-1">*</span>}
      </label>

      {q.type === "open" && (
        <textarea className="textarea mt-1" rows={3}
          value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}

      {q.type === "numeric" && (
        <input className="input mt-1" type="number"
          value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}

      {q.type === "likert" && (
        <div className="flex gap-2 flex-wrap mt-1">
          {Array.from({ length: points }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button"
              className={`btn ${value === String(n) ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onChange(String(n))}>{n}</button>
          ))}
        </div>
      )}

      {q.type === "single" && (
        <div className="space-y-2 mt-1">
          {(q.options ?? []).filter(Boolean).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name={q.id} checked={value === o} onChange={() => onChange(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )}

      {q.type === "multi" && (
        <div className="space-y-2 mt-1">
          {(q.options ?? []).filter(Boolean).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox"
                checked={Array.isArray(value) && value.includes(o)}
                onChange={() => onToggleMulti(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-[color:var(--danger)] mt-1">{error}</p>}
    </div>
  );
}
