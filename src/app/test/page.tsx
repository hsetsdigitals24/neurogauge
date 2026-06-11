"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Stimulus } from "@/components/Stimulus";
import { DEFAULT_CONFIG, loadConfig, saveLastSession } from "@/lib/store";
import {
  BlockResult, ConsentRecord, Demographics, Level, Session,
  StimulusType, StudyConfig, TLXResponse, Trial,
} from "@/lib/types";
import { blockPlan, generateSequence } from "@/lib/sequences";
import { summarize } from "@/lib/scoring";
import { downloadText, summaryWideCsv, trialsLongCsv } from "@/lib/csv";

type Step =
  | { kind: "consent" }
  | { kind: "demographics" }
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

export default function TestPage() {
  const [cfg, setCfg] = useState<StudyConfig>(DEFAULT_CONFIG);
  const [step, setStep] = useState<Step>({ kind: "consent" });
  const [participantId, setParticipantId] = useState("");
  const [demographics, setDemographics] = useState<Demographics>({});
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [blocks, setBlocks] = useState<BlockResult[]>([]);
  const [globalTLX, setGlobalTLX] = useState<TLXResponse | null>(null);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    // One-time hydrate from localStorage + generate a participant id on mount (effect avoids
    // SSR/hydration mismatch from localStorage and Math.random()).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCfg(loadConfig());
    setParticipantId("P-" + Math.random().toString(36).slice(2, 8).toUpperCase());
  }, []);

  const plan = useMemo(() => blockPlan(cfg), [cfg]);

  const onConsent = () => {
    setConsent({ consented: true, ts: Date.now(), participantId });
    setStep(cfg.collectDemographics ? { kind: "demographics" } : { kind: "instructions", planIdx: 0 });
  };

  const finishBlock = (planIdx: number, trials: Trial[]) => {
    const item = plan[planIdx];
    setBlocks((b) => [...b, { stimulusType: item.type, level: item.level, trials }]);
    setStep({ kind: "levelTLX", planIdx });
  };

  const afterLevelTLX = (planIdx: number, tlx: TLXResponse) => {
    setBlocks((b) => b.map((bl, i) => i === planIdx ? { ...bl, perLevelTLX: tlx } : bl));
    if (planIdx + 1 >= plan.length) setStep({ kind: "globalTLX" });
    else setStep({ kind: "instructions", planIdx: planIdx + 1 });
  };

  const finishSession = (gtlx: TLXResponse) => {
    setGlobalTLX(gtlx);
    if (cfg.customQuestions.length) setStep({ kind: "custom" });
    else completeSession(gtlx, customAnswers);
  };

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const submitGuardRef = useRef(false);
  const [clientSubmissionId] = useState(() =>
    (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `csid-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const completeSession = async (gtlx: TLXResponse, answers: Record<string, string>) => {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    const session: Session = {
      participantId,
      startedAt: consent?.ts ?? Date.now(),
      finishedAt: Date.now(),
      config: cfg,
      demographics,
      consent: consent ?? undefined,
      blocks,
      globalTLX: gtlx,
      customAnswers: answers,
    };
    saveLastSession(session);
    setStep({ kind: "done" });
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...session, clientSubmissionId }),
      });
      if (res.ok) setSaveStatus("saved");
      else { setSaveStatus("error"); submitGuardRef.current = false; }
    } catch {
      setSaveStatus("error");
      submitGuardRef.current = false;
    }
  };

  if (!participantId) {
    return (
      <main className="px-6 md:px-10 pb-16 max-w-4xl mx-auto w-full">
          <div className="card p-8 mt-6 text-sm text-[color:var(--muted)]">Preparing session…</div>
        </main>
    );
  }

  if (plan.length === 0) {
    return (
      <main className="px-6 md:px-10 pb-16 max-w-4xl mx-auto w-full">
          <div className="card p-8 mt-6">
            <h1 className="text-2xl font-extrabold">No blocks <span className="gradient-text">configured</span></h1>
            <p className="text-sm text-[color:var(--muted)] mt-2">
              The current study has no stimulus types or no levels selected. Open the admin panel and pick at least one of each.
            </p>
            <div className="mt-4">
              <a className="btn btn-primary" href="/admin">Go to admin →</a>
            </div>
          </div>
        </main>
    );
  }

  return (
    <main className="px-6 md:px-10 pb-16 max-w-4xl mx-auto w-full">
        <ProgressBar step={step} planLen={plan.length} />
        <AnimatePresence mode="wait">
          <motion.div
            key={JSON.stringify(step)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="mt-6"
          >
            {step.kind === "consent" && <ConsentScreen onAgree={onConsent} participantId={participantId} />}
            {step.kind === "demographics" && (
              <DemographicsScreen value={demographics} onChange={setDemographics}
                onNext={() => setStep({ kind: "instructions", planIdx: 0 })} />
            )}
            {step.kind === "instructions" && (
              <InstructionsScreen
                cfg={cfg}
                planItem={plan[step.planIdx]}
                index={step.planIdx} total={plan.length}
                onStart={() => setStep({ kind: "block", planIdx: step.planIdx })}
              />
            )}
            {step.kind === "block" && (
              <BlockRunner
                cfg={cfg}
                planItem={plan[step.planIdx]}
                onFinish={(trials) => finishBlock(step.planIdx, trials)}
              />
            )}
            {step.kind === "levelTLX" && (
              <TLXScreen
                title={`Level questionnaire — ${STIM_LABEL[plan[step.planIdx].type]} · ${plan[step.planIdx].level}-back`}
                onSubmit={(t) => afterLevelTLX(step.planIdx, t)}
              />
            )}
            {step.kind === "globalTLX" && (
              <TLXScreen
                title="Final questionnaire — across all levels"
                onSubmit={finishSession}
              />
            )}
            {step.kind === "custom" && (
              <CustomQuestionsScreen
                cfg={cfg}
                value={customAnswers}
                onChange={setCustomAnswers}
                onSubmit={() => completeSession(globalTLX!, customAnswers)}
              />
            )}
            {step.kind === "done" && (
              <DoneScreen
                participantId={participantId}
                blocks={blocks}
                saveStatus={saveStatus}
                onExportLong={() => {
                  const sess = lastSessionLike(cfg, participantId, consent, demographics, blocks, globalTLX!, customAnswers);
                  downloadText(`${participantId}_trials_long.csv`, trialsLongCsv(sess));
                }}
                onExportWide={() => {
                  const sess = lastSessionLike(cfg, participantId, consent, demographics, blocks, globalTLX!, customAnswers);
                  downloadText(`${participantId}_summary_wide.csv`, summaryWideCsv(sess));
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    );
  }

  function lastSessionLike(
  cfg: StudyConfig, pid: string, consent: ConsentRecord | null,
  demographics: Demographics, blocks: BlockResult[], gtlx: TLXResponse,
  custom: Record<string, string>,
): Session {
  return {
    participantId: pid,
    startedAt: consent?.ts ?? Date.now(),
    finishedAt: Date.now(),
    config: cfg,
    demographics,
    consent: consent ?? undefined,
    blocks, globalTLX: gtlx, customAnswers: custom,
  };
}

function ProgressBar({ step, planLen }: { step: Step; planLen: number }) {
  let pct = 0;
  if (step.kind === "consent") pct = 4;
  else if (step.kind === "demographics") pct = 10;
  else if (step.kind === "instructions" || step.kind === "block" || step.kind === "levelTLX") {
    const idx = (step as { planIdx: number }).planIdx;
    const sub = step.kind === "instructions" ? 0 : step.kind === "block" ? 0.5 : 0.9;
    pct = planLen > 0 ? 15 + ((idx + sub) / planLen) * 70 : 15;
  } else if (step.kind === "globalTLX") pct = 90;
  else if (step.kind === "custom") pct = 95;
  else pct = 100;

  return (
    <div className="mt-4">
      <div className="h-2 rounded-full bg-white border border-[color:var(--border)] overflow-hidden">
        <motion.div
          className="h-full shimmer"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}

function ConsentScreen({ onAgree, participantId }: { onAgree: () => void; participantId: string }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="card p-8">
      <h1 className="text-3xl font-extrabold">Informed <span className="gradient-text">Consent</span></h1>
      <p className="text-sm text-[color:var(--muted)] mt-1">Participant ID: <span className="kbd">{participantId}</span></p>
      <div className="prose prose-sm max-w-none mt-5 text-sm leading-6">
        <p>You are invited to participate in a research study on working memory and cognitive load. The session takes approximately 15–25 minutes.</p>
        <p>You will perform a series of N-back tasks involving letters, shapes, and rotated letters, and answer brief questionnaires after each level.</p>
        <p>Participation is voluntary. You may withdraw at any time without penalty. Your responses are stored in pseudonymous form and used for research purposes only.</p>
      </div>
      <label className="flex items-center gap-2 mt-5">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span className="text-sm">I have read and understood the above and consent to participate.</span>
      </label>
      <div className="mt-5">
        <button className="btn btn-primary disabled:opacity-50" disabled={!agreed} onClick={onAgree}>
          I consent — continue
        </button>
      </div>
    </div>
  );
}

function DemographicsScreen({
  value, onChange, onNext,
}: { value: Demographics; onChange: (d: Demographics) => void; onNext: () => void }) {
  return (
    <div className="card p-8">
      <h1 className="text-3xl font-extrabold">About <span className="gradient-text">you</span></h1>
      <p className="text-sm text-[color:var(--muted)] mt-1">Optional — leave blank if you prefer not to say.</p>
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div><label className="label">Age</label>
          <input className="input" inputMode="numeric"
            value={value.age ?? ""} onChange={(e) => onChange({ ...value, age: e.target.value })} /></div>
        <div><label className="label">Gender</label>
          <select className="select" value={value.gender ?? ""}
            onChange={(e) => onChange({ ...value, gender: e.target.value })}>
            <option value="">—</option>
            <option>Female</option><option>Male</option>  
          </select></div>
        <div><label className="label">Handedness</label>
          <select className="select" value={value.handedness ?? ""}
            onChange={(e) => onChange({ ...value, handedness: e.target.value })}>
            <option value="">—</option>
            <option>Right</option><option>Left</option><option>Ambidextrous</option>
          </select></div>
        <div><label className="label">Education level</label>
          <select className="select" value={value.education ?? ""}
            onChange={(e) => onChange({ ...value, education: e.target.value })}>
            <option value="">—</option>
            <option>Secondary</option><option>Undergraduate</option>
            <option>Postgraduate</option><option>Doctoral</option>
          </select></div>
      </div>
      <div className="mt-6"><button className="btn btn-primary" onClick={onNext}>Continue</button></div>
    </div>
  );
}

function InstructionsScreen({
  cfg, planItem, index, total, onStart,
}: { cfg: StudyConfig; planItem: { type: StimulusType; level: Level }; index: number; total: number; onStart: () => void }) {
  return (
    <div className="card p-8">
      <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">Block {index + 1} of {total}</div>
      <h1 className="text-3xl font-extrabold mt-1">
        {STIM_LABEL[planItem.type]} · <span className="gradient-text">{planItem.level}-back</span>
      </h1>
      <p className="mt-4 text-base">{levelInstruction(planItem.level, planItem.type, cfg.zeroBackTarget)}</p>
      <div className="mt-5 flex gap-3 flex-wrap text-sm">
        <span className="kbd">Y</span> <span className="text-[color:var(--muted)]">= Yes</span>
        <span className="kbd">N</span> <span className="text-[color:var(--muted)]">= No</span>
        {cfg.timingMode === "self" && <><span className="kbd">Space</span> <span className="text-[color:var(--muted)]">= Next</span></>}
      </div>
      <div className="mt-6"><button className="btn btn-primary" onClick={onStart}>Begin block →</button></div>
    </div>
  );
}

function BlockRunner({
  cfg, planItem, onFinish,
}: { cfg: StudyConfig; planItem: { type: StimulusType; level: Level }; onFinish: (trials: Trial[]) => void }) {
  const seqRef = useRef(generateSequence(planItem.type, planItem.level, cfg, Date.now() & 0x7fffffff));
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"display" | "response" | "blank">("display");
  const [trials, setTrials] = useState<Trial[]>([]);
  const onsetRef = useRef<number>(0);
  const respondedRef = useRef(false);
  const responseRef = useRef<{ yes: boolean | null; rt: number | null }>({ yes: null, rt: null });

  const seq = seqRef.current;
  const cur = seq[idx];

  // Timing engine
  useEffect(() => {
    if (!cur) return;
    onsetRef.current = performance.now();
    respondedRef.current = false;
    responseRef.current = { yes: null, rt: null };
    setPhase("display");

    if (cfg.timingMode === "auto") {
      const t1 = setTimeout(() => setPhase("response"), cfg.displayMs);
      const t2 = setTimeout(() => commit(), cfg.totalMs);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    // self-paced — show stimulus indefinitely
    return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function recordResponse(yes: boolean) {
    if (respondedRef.current) return;
    respondedRef.current = true;
    responseRef.current = { yes, rt: performance.now() - onsetRef.current };
    if (cfg.timingMode === "self") commit();
  }

  function commit() {
    const r = responseRef.current;
    const expected = cur.expectedMatch;
    const correct =
      cur.isPriming ? null :
      expected === null ? null :
      r.yes === null ? false :
      r.yes === expected;
    const t: Trial = {
      trialIndex: idx,
      stimulusType: planItem.type,
      level: planItem.level,
      stimulus: cur.stimulus,
      isPriming: cur.isPriming,
      expectedMatch: cur.expectedMatch,
      responded: respondedRef.current,
      responseYes: r.yes,
      rtMs: r.rt,
      correct,
      onsetTs: onsetRef.current,
    };
    const next = [...trials, t];
    setTrials(next);
    if (idx + 1 >= seq.length) onFinish(next);
    else setIdx(idx + 1);
  }

  // Keyboard
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
    <div className="card p-8 flex flex-col items-center">
      <div className="w-full flex justify-between text-xs text-[color:var(--muted)]">
        <span>{STIM_LABEL[planItem.type]} · {planItem.level}-back</span>
        <span>Trial {idx + 1} / {seq.length}</span>
      </div>
      <div className="my-6 min-h-[260px] flex items-center justify-center">
        <Stimulus type={planItem.type} value={cur.stimulus} visible={visible} />
      </div>
      <div className="flex gap-3">
        <button className="btn btn-ghost" onClick={() => recordResponse(false)}>No <span className="kbd ml-1">N</span></button>
        <button className="btn btn-success" onClick={() => recordResponse(true)}>Yes <span className="kbd ml-1">Y</span></button>
        {cfg.timingMode === "self" && (
          <button className="btn btn-primary" onClick={() => commit()}>Next <span className="kbd ml-1">Space</span></button>
        )}
      </div>
      <div className="mt-3 text-xs text-[color:var(--muted)]">
        {cur.isPriming ? "Priming trial — not scored" : phase === "response" ? "Respond now" : "Watch closely…"}
      </div>
    </div>
  );
}

function Slider({ label, hint, value, onChange, min = 0, max = 100 }:{
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

function TLXScreen({ title, onSubmit }: { title: string; onSubmit: (t: TLXResponse) => void }) {
  const [t, setT] = useState<TLXResponse>({
    mentalDemand: 50, physicalDemand: 50, temporalDemand: 50,
    performance: 50, effort: 50, frustration: 50, paasMentalEffort: 5,
  });
  const set = <K extends keyof TLXResponse>(k: K, v: TLXResponse[K]) => setT((p) => ({ ...p, [k]: v }));
  return (
    <div className="card p-8">
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
      <div className="mt-6"><button className="btn btn-primary" onClick={() => onSubmit(t)}>Submit</button></div>
    </div>
  );
}

function CustomQuestionsScreen({
  cfg, value, onChange, onSubmit,
}: { cfg: StudyConfig; value: Record<string, string>; onChange: (v: Record<string,string>) => void; onSubmit: () => void }) {
  const roman = ["i","ii","iii","iv","v","vi","vii","viii","ix","x"];
  const alpha = "abcdefghij".split("");
  return (
    <div className="card p-8">
      <h2 className="text-2xl font-extrabold">Additional <span className="gradient-text">questions</span></h2>
      <div className="space-y-5 mt-6">
        {cfg.customQuestions.map((q) => (
          <div key={q.id}>
            <label className="label">{q.prompt || "(no prompt)"}</label>
            {q.type === "open" && (
              <textarea className="textarea" rows={3}
                value={value[q.id] ?? ""} onChange={(e) => onChange({ ...value, [q.id]: e.target.value })} />
            )}
            {q.type === "likert" && (
              <div className="flex gap-2 flex-wrap">
                {[1,2,3,4,5].map(n => (
                  <button key={n}
                    className={`btn ${value[q.id] === String(n) ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => onChange({ ...value, [q.id]: String(n) })}>{n}</button>
                ))}
              </div>
            )}
            {(q.type === "mcq-alpha" || q.type === "mcq-roman") && (
              <div className="space-y-2">
                {(q.options ?? []).filter(Boolean).map((o, i) => {
                  const label = q.type === "mcq-alpha" ? alpha[i] : roman[i];
                  const id = `${label}. ${o}`;
                  return (
                    <label key={i} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={q.id} checked={value[q.id] === id}
                        onChange={() => onChange({ ...value, [q.id]: id })} />
                      <span><b>{label}.</b> {o}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6"><button className="btn btn-primary" onClick={onSubmit}>Finish</button></div>
    </div>
  );
}

function DoneScreen({
  participantId, blocks, onExportLong, onExportWide, saveStatus,
}: {
  participantId: string; blocks: BlockResult[];
  onExportLong: () => void; onExportWide: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
}) {
  const statusBadge =
    saveStatus === "saving" ? <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">Saving to database…</span> :
    saveStatus === "saved" ? <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">✓ Saved to database</span> :
    saveStatus === "error" ? <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">Database save failed — local export still available</span> :
    null;
  return (
    <div className="card p-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-3xl font-extrabold">Session <span className="gradient-text">complete</span> ✨</h2>
          <p className="text-sm text-[color:var(--muted)] mt-1">Participant {participantId}. Thank you for your time.</p>
        </div>
        {statusBadge}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[color:var(--muted)]">
            <tr>
              <th className="py-2">Stimulus</th><th>Level</th><th>Accuracy</th>
              <th>d′</th><th>Hits</th><th>FA</th><th>RT (ms)</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b, i) => {
              const m = summarize(b.trials);
              return (
                <tr key={i} className="border-t border-[color:var(--border)]">
                  <td className="py-2 capitalize">{b.stimulusType.replace("-", " ")}</td>
                  <td>{b.level}</td>
                  <td>{(m.accuracy * 100).toFixed(1)}%</td>
                  <td>{m.dPrime.toFixed(2)}</td>
                  <td>{m.hits}</td>
                  <td>{m.falseAlarms}</td>
                  <td>{m.rtMean ? m.rtMean.toFixed(0) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={onExportLong}>Export trials (long CSV)</button>
        <button className="btn btn-ghost" onClick={onExportWide}>Export summary (wide CSV)</button>
      </div>
      <p className="text-xs text-[color:var(--muted)] mt-3">
        CSVs open directly in Excel and SPSS. The wide-format file matches the layout most analysts use as input.
      </p>
    </div>
  );
}
