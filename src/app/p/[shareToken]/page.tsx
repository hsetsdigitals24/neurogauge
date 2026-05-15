"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Stimulus } from "@/components/Stimulus";
import {
  BlockResult, ConsentRecord, Level, Session,
  StimulusType, StudyConfig, TLXResponse, Trial, CustomQuestion,
} from "@/lib/types";
import { blockPlan, generateSequence } from "@/lib/sequences";
import { summarize } from "@/lib/scoring";
import { DEFAULT_CONFIG } from "@/lib/config";

/* ── Types ─────────────────────────────────────────────── */
interface TakerInfo {
  email: string;
  age: string;
  handedness: string;
  education: string;
}

type Step =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "consent" }
  | { kind: "takerInfo" }
  | { kind: "instructions"; planIdx: number }
  | { kind: "block"; planIdx: number }
  | { kind: "levelTLX"; planIdx: number }
  | { kind: "globalTLX" }
  | { kind: "custom" }
  | { kind: "done" };

const STIM_LABEL: Record<StimulusType, string> = {
  letters: "Letters", shapes: "Shapes", "rotated-e": "Rotated E",
};

function levelInstruction(level: Level, type: StimulusType, target: string) {
  if (level === 0) {
    if (type === "letters") return `Click YES whenever you see the letter "${target}". Otherwise click NO.`;
    if (type === "shapes") return `Click YES whenever you see the target shape (the first one shown). Otherwise click NO.`;
    return `Click YES whenever you see the target rotation (the first one shown). Otherwise click NO.`;
  }
  const noun = type === "letters" ? "letter" : type === "shapes" ? "shape" : "rotation";
  if (level === 1) return `Click YES if the current ${noun} matches the previous one. The first ${noun} is priming — click NO.`;
  return `Click YES if the current ${noun} matches the one shown ${level} screens ago. The first ${level} ${noun}s are priming — click NO.`;
}

/* ── Main page component ───────────────────────────────── */
export default function PublicTestPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [cfg, setCfg] = useState<StudyConfig>(DEFAULT_CONFIG);
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [participantId] = useState("P-" + Math.random().toString(36).slice(2, 8).toUpperCase());
  const [takerInfo, setTakerInfo] = useState<TakerInfo>({ email: "", age: "", handedness: "right", education: "" });
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [blocks, setBlocks] = useState<BlockResult[]>([]);
  const [globalTLX, setGlobalTLX] = useState<TLXResponse | null>(null);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  /* Load project config */
  useEffect(() => {
    fetch(`/api/public/${shareToken}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) { setStep({ kind: "notfound" }); return; }
        setProjectId(data.id);
        setProjectName(data.name);
        setCfg({ ...DEFAULT_CONFIG, ...data.config });
        setStep({ kind: "consent" });
      });
  }, [shareToken]);

  const plan = useMemo(() => blockPlan(cfg), [cfg]);

  const onConsent = () => {
    setConsent({ consented: true, ts: Date.now(), participantId });
    setStep({ kind: "takerInfo" });
  };

  const onTakerInfo = (info: TakerInfo) => {
    setTakerInfo(info);
    setStep({ kind: "instructions", planIdx: 0 });
  };

  const finishBlock = (planIdx: number, trials: Trial[]) => {
    const item = plan[planIdx];
    setBlocks((b) => [...b, { stimulusType: item.type, level: item.level, trials }]);
    setStep({ kind: "levelTLX", planIdx });
  };

  const afterLevelTLX = (planIdx: number, tlx: TLXResponse) => {
    setBlocks((b) => b.map((bl, i) => (i === planIdx ? { ...bl, perLevelTLX: tlx } : bl)));
    if (planIdx + 1 >= plan.length) setStep({ kind: "globalTLX" });
    else setStep({ kind: "instructions", planIdx: planIdx + 1 });
  };

  const finishSession = (gtlx: TLXResponse) => {
    setGlobalTLX(gtlx);
    if (cfg.customQuestions.length) setStep({ kind: "custom" });
    else completeSession(gtlx, customAnswers);
  };

  const completeSession = async (gtlx: TLXResponse, answers: Record<string, string>) => {
    setStep({ kind: "done" });
    setSaveStatus("saving");
    const session: Session & { takerEmail: string; takerAge: string; takerHandedness: string; takerEducation: string } = {
      participantId,
      startedAt: consent?.ts ?? Date.now(),
      finishedAt: Date.now(),
      config: cfg,
      demographics: {},
      consent: consent ?? undefined,
      blocks,
      globalTLX: gtlx,
      customAnswers: answers,
      takerEmail: takerInfo.email,
      takerAge: takerInfo.age,
      takerHandedness: takerInfo.handedness,
      takerEducation: takerInfo.education,
    };
    try {
      const res = await fetch(`/api/public/${shareToken}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...session, consentGiven: consent?.consented ?? false }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedSessionId(data.id);
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  };

  /* ── Not found ─────────── */
  if (step.kind === "notfound") {
    return (
      <MinimalShell>
        <div className="card p-10 text-center max-w-md mx-auto">
          <h1 className="text-2xl font-extrabold mb-2">Test not found</h1>
          <p className="text-[color:var(--muted)] text-sm">
            This link may be invalid or the study has ended.
          </p>
        </div>
      </MinimalShell>
    );
  }

  if (step.kind === "loading") {
    return (
      <MinimalShell>
        <div className="card p-10 text-center max-w-md mx-auto text-[color:var(--muted)] text-sm">
          Loading study…
        </div>
      </MinimalShell>
    );
  }

  if (plan.length === 0) {
    return (
      <MinimalShell>
        <div className="card p-10 text-center max-w-md mx-auto">
          <h1 className="text-2xl font-extrabold mb-2">Study not configured</h1>
          <p className="text-[color:var(--muted)] text-sm">
            This study has no blocks configured. Please contact the researcher.
          </p>
        </div>
      </MinimalShell>
    );
  }

  return (
    <MinimalShell title={projectName}>
      <div className="max-w-4xl mx-auto w-full">
        {step.kind !== "consent" && step.kind !== "takerInfo" && step.kind !== "done" && (
          <ProgressBar step={step} planLen={plan.length} />
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={JSON.stringify(step)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="mt-6"
          >
            {step.kind === "consent" && (
              <ConsentScreen projectName={projectName} participantId={participantId} onAgree={onConsent} />
            )}
            {step.kind === "takerInfo" && (
              <TakerInfoScreen value={takerInfo} onChange={setTakerInfo} onNext={onTakerInfo} />
            )}
            {step.kind === "instructions" && (
              <InstructionsScreen
                cfg={cfg} planItem={plan[step.planIdx]}
                index={step.planIdx} total={plan.length}
                onStart={() => setStep({ kind: "block", planIdx: step.planIdx })}
              />
            )}
            {step.kind === "block" && (
              <BlockRunner cfg={cfg} planItem={plan[step.planIdx]}
                onFinish={(trials) => finishBlock(step.planIdx, trials)} />
            )}
            {step.kind === "levelTLX" && (
              <TLXScreen
                title={`Level questionnaire — ${STIM_LABEL[plan[step.planIdx].type]} · ${plan[step.planIdx].level}-back`}
                onSubmit={(t) => afterLevelTLX(step.planIdx, t)} />
            )}
            {step.kind === "globalTLX" && (
              <TLXScreen title="Final questionnaire — across all levels" onSubmit={finishSession} />
            )}
            {step.kind === "custom" && (
              <CustomQuestionsScreen cfg={cfg} value={customAnswers} onChange={setCustomAnswers}
                onSubmit={() => completeSession(globalTLX!, customAnswers)} />
            )}
            {step.kind === "done" && (
              <DoneScreen
                blocks={blocks}
                takerEmail={takerInfo.email}
                saveStatus={saveStatus}
                savedSessionId={savedSessionId}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </MinimalShell>
  );
}

/* ── Shell ─────────────────────────────────────────────── */
function MinimalShell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <main className="min-h-screen px-6 md:px-10 pb-16 w-full">
      {children}
    </main>
  );
}

/* ── Progress bar ──────────────────────────────────────── */
function ProgressBar({ step, planLen }: { step: Step; planLen: number }) {
  const total = planLen;
  let done = 0;
  if (step.kind === "instructions") done = step.planIdx;
  else if (step.kind === "block") done = step.planIdx;
  else if (step.kind === "levelTLX") done = step.planIdx + 0.5;
  else if (step.kind === "globalTLX" || step.kind === "custom") done = total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mt-4 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <motion.div className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--primary-2)]"
        animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
    </div>
  );
}

/* ── Consent screen ───────────────────────────────────── */
function ConsentScreen({ projectName, participantId, onAgree }: {
  projectName: string; participantId: string; onAgree: () => void;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="card p-8 max-w-2xl mx-auto">
      <h2 className="text-3xl font-extrabold">Informed <span className="gradient-text">consent</span></h2>
      <p className="text-sm text-[color:var(--muted)] mt-1 mb-6">Study: <strong>{projectName}</strong></p>

      <div className="text-sm space-y-3 text-[color:var(--fg)] leading-relaxed">
        <p>You are being invited to participate in a cognitive research study using the N-back task, which measures working memory and attention. The study involves responding to sequences of visual stimuli and completing short questionnaires about your experience.</p>
        <p><strong>Duration:</strong> Approximately 15–40 minutes depending on the configuration.</p>
        <p><strong>Risks:</strong> The task may cause mild mental fatigue. You may stop at any time.</p>
        <p><strong>Data collected:</strong> Your email address, age, handedness, level of education, and cognitive performance data. Your email is used only to let you retrieve your results.</p>
        <p><strong>Confidentiality:</strong> Individual results are linked to your email and are only visible to you and the study researchers.</p>
        <p><strong>Voluntary participation:</strong> Participation is voluntary. You may withdraw at any time without consequence.</p>
      </div>

      <label className="flex items-start gap-3 mt-6 cursor-pointer">
        <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span className="text-sm">
          I have read and understood the above information. I voluntarily agree to participate in this study.
        </span>
      </label>

      <p className="text-xs text-[color:var(--muted)] mt-2">Participant ID: {participantId}</p>
      <div className="mt-6">
        <button className="btn btn-primary" disabled={!checked} onClick={onAgree}>
          I agree — begin study →
        </button>
      </div>
    </div>
  );
}

/* ── Taker info screen ────────────────────────────────── */
function TakerInfoScreen({ value, onChange, onNext }: {
  value: TakerInfo; onChange: (v: TakerInfo) => void; onNext: (v: TakerInfo) => void;
}) {
  const [errors, setErrors] = useState<Partial<TakerInfo>>({});

  function set<K extends keyof TakerInfo>(k: K, v: TakerInfo[K]) {
    onChange({ ...value, [k]: v });
  }

  function validate() {
    const e: Partial<TakerInfo> = {};
    if (!value.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "Valid email required";
    if (!value.age || isNaN(Number(value.age)) || Number(value.age) < 5 || Number(value.age) > 120)
      e.age = "Valid age required (5–120)";
    if (!value.education) e.education = "Please select your highest education level";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (validate()) onNext(value);
  }

  return (
    <div className="card p-8 max-w-lg mx-auto">
      <h2 className="text-2xl font-extrabold mb-1">About <span className="gradient-text">you</span></h2>
      <p className="text-sm text-[color:var(--muted)] mb-6">
        This information helps researchers interpret the results. Your email lets you retrieve your results later.
      </p>

      <div className="space-y-4">
        <div>
          <label className="label">Email address <span className="text-[color:var(--danger)]">*</span></label>
          <input className="input" type="email" autoComplete="email"
            placeholder="you@example.com"
            value={value.email} onChange={(e) => set("email", e.target.value)} />
          {errors.email && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="label">Age <span className="text-[color:var(--danger)]">*</span></label>
          <input className="input" type="number" min={5} max={120} placeholder="e.g. 24"
            value={value.age} onChange={(e) => set("age", e.target.value)} />
          {errors.age && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.age}</p>}
        </div>

        <div>
          <label className="label">Handedness <span className="text-[color:var(--danger)]">*</span></label>
          <div className="flex flex-wrap gap-2 mt-1">
            {["right", "left", "ambidextrous"].map((h) => (
              <button key={h}
                className={`btn flex-1 capitalize ${value.handedness === h ? "btn-primary" : "btn-ghost"}`}
                onClick={() => set("handedness", h)}>{h}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Highest level of education <span className="text-[color:var(--danger)]">*</span></label>
          <select className="select mt-1" value={value.education} onChange={(e) => set("education", e.target.value)}>
            <option value="">Select…</option>
            <option value="primary">Primary school</option>
            <option value="secondary">Secondary / high school</option>
            <option value="vocational">Vocational / trade qualification</option>
            <option value="bachelors">Bachelor's degree</option>
            <option value="masters">Master's degree</option>
            <option value="doctorate">Doctorate (PhD)</option>
            <option value="other">Other</option>
          </select>
          {errors.education && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.education}</p>}
        </div>
      </div>

      <div className="mt-6">
        <button className="btn btn-primary" onClick={submit}>Continue →</button>
      </div>
    </div>
  );
}

/* ── Instructions screen ──────────────────────────────── */
function InstructionsScreen({ cfg, planItem, index, total, onStart }: {
  cfg: StudyConfig;
  planItem: { type: StimulusType; level: Level };
  index: number; total: number;
  onStart: () => void;
}) {
  return (
    <div className="card p-8 max-w-2xl mx-auto">
      <div className="text-xs text-[color:var(--muted)] mb-2">Block {index + 1} of {total}</div>
      <h2 className="text-2xl font-extrabold">
        {STIM_LABEL[planItem.type]} · <span className="gradient-text">{planItem.level}-back</span>
      </h2>
      <p className="mt-4 text-[color:var(--fg)] leading-relaxed">
        {levelInstruction(planItem.level, planItem.type, cfg.zeroBackTarget)}
      </p>
      <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-800">
        <strong>Controls:</strong> Press <kbd className="kbd">Y</kbd> for Yes, <kbd className="kbd">N</kbd> for No.
        {cfg.timingMode === "self" && <> Press <kbd className="kbd">Space</kbd> to advance.</>}
      </div>
      <div className="mt-6">
        <button className="btn btn-primary" onClick={onStart}>Start block →</button>
      </div>
    </div>
  );
}

/* ── Block runner ─────────────────────────────────────── */
function BlockRunner({ cfg, planItem, onFinish }: {
  cfg: StudyConfig;
  planItem: { type: StimulusType; level: Level };
  onFinish: (trials: Trial[]) => void;
}) {
  const seq = useMemo(
    () => generateSequence(planItem.type, planItem.level, cfg, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"display" | "response">("display");
  const [trials, setTrials] = useState<Trial[]>([]);
  const onsetRef = useRef<number>(performance.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cur = seq[idx];

  const commit = () => {
    const t = trials[idx] ?? {
      trialIndex: idx,
      stimulusType: planItem.type,
      level: planItem.level,
      stimulus: cur.stimulus,
      isPriming: cur.isPriming,
      expectedMatch: cur.expectedMatch,
      responded: false,
      responseYes: null,
      rtMs: null,
      correct: null,
      onsetTs: onsetRef.current,
    };
    const next = [...trials.slice(0, idx), t];
    setTrials(next);
    if (idx + 1 >= seq.length) { onFinish(next); return; }
    setIdx(idx + 1);
    setPhase("display");
    onsetRef.current = performance.now();
  };

  useEffect(() => {
    if (cfg.timingMode === "self") return;
    setPhase("display");
    onsetRef.current = performance.now();
    timerRef.current = setTimeout(() => setPhase("response"), cfg.displayMs);
    const total = setTimeout(commit, cfg.totalMs);
    return () => { clearTimeout(timerRef.current!); clearTimeout(total); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function recordResponse(yes: boolean) {
    const now = performance.now();
    const rt = now - onsetRef.current;
    const expected = cur.expectedMatch;
    const correct = cur.isPriming ? null : expected !== null ? yes === expected : null;
    const t: Trial = {
      trialIndex: idx,
      stimulusType: planItem.type,
      level: planItem.level,
      stimulus: cur.stimulus,
      isPriming: cur.isPriming,
      expectedMatch: cur.expectedMatch,
      responded: true,
      responseYes: yes,
      rtMs: rt,
      correct,
      onsetTs: onsetRef.current,
    };
    const next = [...trials.slice(0, idx), t];
    setTrials(next);
    if (idx + 1 >= seq.length) { onFinish(next); return; }
    setIdx(idx + 1);
    setPhase("display");
    onsetRef.current = performance.now();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "y" || e.key === "Y") recordResponse(true);
      else if (e.key === "n" || e.key === "N") recordResponse(false);
      else if (e.key === " " && cfg.timingMode === "self") commit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  if (!cur) return null;
  const visible = cfg.timingMode === "self" ? true : phase === "display";

  return (
    <div className="card p-8 flex flex-col items-center max-w-2xl mx-auto">
      <div className="w-full flex justify-between text-xs text-[color:var(--muted)]">
        <span>{STIM_LABEL[planItem.type]} · {planItem.level}-back</span>
        <span>Trial {idx + 1} / {seq.length}</span>
      </div>
      <div className="my-6 min-h-[260px] flex items-center justify-center">
        <Stimulus type={planItem.type} value={cur.stimulus} visible={visible} />
      </div>
      <div className="flex gap-3">
        <button className="btn btn-ghost" onClick={() => recordResponse(false)}>
          No <span className="kbd ml-1">N</span>
        </button>
        <button className="btn btn-success" onClick={() => recordResponse(true)}>
          Yes <span className="kbd ml-1">Y</span>
        </button>
        {cfg.timingMode === "self" && (
          <button className="btn btn-primary" onClick={commit}>Next <span className="kbd ml-1">Space</span></button>
        )}
      </div>
      <div className="mt-3 text-xs text-[color:var(--muted)]">
        {cur.isPriming ? "Priming trial — not scored" : phase === "response" ? "Respond now" : "Watch closely…"}
      </div>
    </div>
  );
}

/* ── Slider ───────────────────────────────────────────── */
function Slider({ label, hint, value, onChange, min = 0, max = 100 }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label">{label}</label>
        <span className="text-sm font-bold gradient-text">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-[color:var(--primary)]" />
      {hint && <p className="text-xs text-[color:var(--muted)] mt-1">{hint}</p>}
    </div>
  );
}

/* ── TLX screen ───────────────────────────────────────── */
function TLXScreen({ title, onSubmit }: { title: string; onSubmit: (t: TLXResponse) => void }) {
  const [t, setT] = useState<TLXResponse>({
    mentalDemand: 50, physicalDemand: 50, temporalDemand: 50,
    performance: 50, effort: 50, frustration: 50, paasMentalEffort: 5,
  });
  const set = <K extends keyof TLXResponse>(k: K, v: TLXResponse[K]) => setT((p) => ({ ...p, [k]: v }));
  return (
    <div className="card p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-extrabold">{title}</h2>
      <p className="text-sm text-[color:var(--muted)] mt-1">Move each slider to indicate your experience.</p>
      <div className="grid md:grid-cols-2 gap-5 mt-6">
        <Slider label="Mental demand" hint="Thinking, deciding, calculating, remembering"
          value={t.mentalDemand} onChange={(v) => set("mentalDemand", v)} />
        <Slider label="Physical demand" hint="Pushing, pulling, controlling"
          value={t.physicalDemand} onChange={(v) => set("physicalDemand", v)} />
        <Slider label="Temporal demand" hint="Time pressure / pace"
          value={t.temporalDemand} onChange={(v) => set("temporalDemand", v)} />
        <Slider label="Performance" hint="0 = perfect, 100 = failure"
          value={t.performance} onChange={(v) => set("performance", v)} />
        <Slider label="Effort" hint="How hard you had to work"
          value={t.effort} onChange={(v) => set("effort", v)} />
        <Slider label="Frustration" hint="Insecurity, irritation, stress"
          value={t.frustration} onChange={(v) => set("frustration", v)} />
        <Slider label="Mental effort (Paas, 1–9)" hint="1 = very very low, 9 = very very high"
          value={t.paasMentalEffort} min={1} max={9}
          onChange={(v) => set("paasMentalEffort", v)} />
      </div>
      <div className="mt-6">
        <button className="btn btn-primary" onClick={() => onSubmit(t)}>Submit →</button>
      </div>
    </div>
  );
}

/* ── Custom questions ─────────────────────────────────── */
function CustomQuestionsScreen({ cfg, value, onChange, onSubmit }: {
  cfg: StudyConfig; value: Record<string, string>;
  onChange: (v: Record<string, string>) => void; onSubmit: () => void;
}) {
  const roman = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
  const alpha = "abcdefghij".split("");
  return (
    <div className="card p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-extrabold">Additional <span className="gradient-text">questions</span></h2>
      <div className="space-y-5 mt-6">
        {cfg.customQuestions.map((q: CustomQuestion) => (
          <div key={q.id}>
            <label className="label">{q.prompt || "(no prompt)"}</label>
            {q.type === "open" && (
              <textarea className="textarea" rows={3}
                value={value[q.id] ?? ""} onChange={(e) => onChange({ ...value, [q.id]: e.target.value })} />
            )}
            {q.type === "likert" && (
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n}
                    className={`btn ${value[q.id] === String(n) ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => onChange({ ...value, [q.id]: String(n) })}>{n}</button>
                ))}
              </div>
            )}
            {(q.type === "mcq-alpha" || q.type === "mcq-roman") && (
              <div className="space-y-2">
                {(q.options ?? []).map((o, i) => {
                  const label = q.type === "mcq-alpha" ? alpha[i] : roman[i];
                  const oid = `${label}. ${o}`;
                  return (
                    <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name={q.id} checked={value[q.id] === oid}
                        onChange={() => onChange({ ...value, [q.id]: oid })} />
                      <span><b>{label}.</b> {o}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6">
        <button className="btn btn-primary" onClick={onSubmit}>Finish →</button>
      </div>
    </div>
  );
}

/* ── Done screen ──────────────────────────────────────── */
function DoneScreen({ blocks, takerEmail, saveStatus, savedSessionId }: {
  blocks: BlockResult[]; takerEmail: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  savedSessionId: string | null;
}) {
  const statusEl =
    saveStatus === "saving"
      ? <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">Saving results…</span>
      : saveStatus === "saved"
      ? <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">✓ Results saved</span>
      : saveStatus === "error"
      ? <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">Save failed — contact researcher</span>
      : null;

  return (
    <div className="card p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-3xl font-extrabold">Session <span className="gradient-text">complete</span> ✨</h2>
          <p className="text-sm text-[color:var(--muted)] mt-1">Thank you for participating!</p>
        </div>
        {statusEl}
      </div>

      {/* Results preview */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[color:var(--muted)]">
            <tr>
              <th className="py-2 pr-4">Stimulus</th>
              <th className="pr-4">Level</th>
              <th className="pr-4">Accuracy</th>
              <th className="pr-4">d′</th>
              <th className="pr-4">Hits</th>
              <th className="pr-4">False Alarms</th>
              <th>RT mean (ms)</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b, i) => {
              const m = summarize(b.trials);
              return (
                <tr key={i} className="border-t border-[color:var(--border)]">
                  <td className="py-2 pr-4 capitalize">{b.stimulusType.replace("-", " ")}</td>
                  <td className="pr-4">{b.level}-back</td>
                  <td className="pr-4">{(m.accuracy * 100).toFixed(1)}%</td>
                  <td className="pr-4">{m.dPrime.toFixed(2)}</td>
                  <td className="pr-4">{m.hits}</td>
                  <td className="pr-4">{m.falseAlarms}</td>
                  <td>{m.rtMean ? m.rtMean.toFixed(0) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Retrieve results CTA */}
      <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
        <p className="text-sm font-semibold text-indigo-900 mb-1">Retrieve your results anytime</p>
        <p className="text-sm text-indigo-700 mb-3">
          Use your email <strong>{takerEmail}</strong> to look up these results later.
        </p>
        <a href={`/results?email=${encodeURIComponent(takerEmail)}`}
          className="btn btn-primary text-sm inline-flex">
          View my full results →
        </a>
      </div>
    </div>
  );
}
