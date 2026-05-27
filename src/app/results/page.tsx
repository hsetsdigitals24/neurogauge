"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Search, ChevronDown, ChevronUp, FlaskConical, Mail } from "lucide-react";
import { summarize } from "@/lib/scoring";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySession = any;

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [sessions, setSessions] = useState<AnySession[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("email");
    if (q) { setEmail(q); lookup(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(emailOverride?: string) {
    const q = (emailOverride ?? email).trim().toLowerCase();
    if (!q.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return;
    setStatus("loading");
    setSessions([]);
    try {
      router.replace(`/results?email=${encodeURIComponent(q)}`, { scroll: false });
      const res = await fetch(`/api/results?email=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* Search card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8 mt-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Mail className="w-5 h-5 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-extrabold">
            My <span className="gradient-text">results</span>
          </h1>
        </div>
        <p className="text-sm text-[color:var(--muted)] mb-6">
          Enter the email address you used when taking a test to see your results.
        </p>
        <div className="flex flex-col md:flex-row gap-4 md:gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-0"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <button
            className="btn btn-primary flex items-center gap-2 shrink-0"
            onClick={() => lookup()}
            disabled={status === "loading"}
          >
            <Search className="w-4 h-4" />
            {status === "loading" ? "Searching…" : "Find results"}
          </button>
        </div>
      </motion.div>

      {/* Error */}
      {status === "error" && (
        <p className="mt-4 text-sm text-[color:var(--danger)]">Something went wrong — please try again.</p>
      )}

      {/* No results */}
      {status === "done" && sessions.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-10 text-center mt-6">
          <FlaskConical className="w-10 h-10 mx-auto text-[color:var(--muted)] mb-3" />
          <h2 className="font-bold text-lg">No sessions found</h2>
          <p className="text-sm text-[color:var(--muted)] mt-1">
            No test sessions are associated with <strong>{email}</strong>. Double-check the email you used.
          </p>
        </motion.div>
      )}

      {/* Sessions */}
      {status === "done" && sessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <p className="text-sm text-[color:var(--muted)] mb-4">
            Found <strong>{sessions.length}</strong> session{sessions.length !== 1 ? "s" : ""} for{" "}
            <strong>{email}</strong>
          </p>
          <div className="space-y-4">
            {sessions.map((s: AnySession, i: number) => (
              <SessionCard
                key={s.id}
                session={s}
                index={i}
                expanded={expandedSession === s.id}
                onToggle={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function SessionCard({ session, index, expanded, onToggle }: {
  session: AnySession; index: number; expanded: boolean; onToggle: () => void;
}) {
  const blocks: AnySession[] = session.blocks ?? [];
  const totalTrials = blocks.reduce((s: number, b: AnySession) => s + (b.trials?.length ?? 0), 0);
  const date = new Date(session.createdAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="card overflow-hidden"
    >
      {/* Header row */}
      <button
        className="w-full p-5 flex items-start justify-between gap-4 text-left hover:bg-gray-50/60 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold">
              {session.project?.name ?? "Study"}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              {blocks.length} block{blocks.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
              {totalTrials} trials
            </span>
          </div>
          <div className="flex flex-wrap gap-4 mt-1 text-xs text-[color:var(--muted)]">
            <span>{date.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
            <span>{date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-5 h-5 text-[color:var(--muted)] shrink-0 mt-0.5" />
          : <ChevronDown className="w-5 h-5 text-[color:var(--muted)] shrink-0 mt-0.5" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-[color:var(--border)]"
          >
            <div className="p-5 space-y-6">
              {/* Participant info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Age", value: session.takerAge },
                  { label: "Handedness", value: capitalize(session.takerHandedness) },
                  { label: "Education", value: EDU_LABELS[session.takerEducation] ?? session.takerEducation },
                  { label: "Participant ID", value: session.participantId },
                ].map((d) => (
                  <div key={d.label} className="p-3 bg-gray-50 rounded-xl border border-[color:var(--border)]">
                    <div className="text-xs text-[color:var(--muted)]">{d.label}</div>
                    <div className="text-sm font-semibold mt-0.5 truncate">{d.value}</div>
                  </div>
                ))}
              </div>

              {/* Block results */}
              <div>
                <h4 className="font-bold mb-3">Performance by block</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-[color:var(--muted)]">
                      <tr>
                        <th className="py-2 pr-4">Stimulus</th>
                        <th className="pr-4">N-back</th>
                        <th className="pr-4">Accuracy</th>
                        <th className="pr-4">d′ score</th>
                        <th className="pr-4">Hits</th>
                        <th className="pr-4">Misses</th>
                        <th className="pr-4">False alarms</th>
                        <th>Avg RT (ms)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blocks.map((b: AnySession, bi: number) => {
                        const m = summarize(b.trials ?? []);
                        return (
                          <tr key={bi} className="border-t border-[color:var(--border)]">
                            <td className="py-2 pr-4 capitalize">{(b.stimulusType ?? "").replace("-", " ")}</td>
                            <td className="pr-4">
                              <span className="font-mono">{b.level}-back</span>
                              {b.level === 0 && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 uppercase tracking-wide">Control</span>
                              )}
                            </td>
                            <td className="pr-4">
                              <AccuracyBadge val={m.accuracy} />
                            </td>
                            <td className="pr-4 font-mono">{m.dPrime.toFixed(2)}</td>
                            <td className="pr-4 text-emerald-700">{m.hits}</td>
                            <td className="pr-4 text-rose-600">{m.misses}</td>
                            <td className="pr-4 text-amber-600">{m.falseAlarms}</td>
                            <td className="font-mono">{m.rtMean ? m.rtMean.toFixed(0) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Aggregate stats */}
              <div>
                <h4 className="font-bold mb-3">Overall summary</h4>
                <AggregateSummary blocks={blocks} />
              </div>

              {/* Per-level TLX */}
              <PerLevelTLX blocks={blocks} />

              {/* TLX info */}
              {session.globalTLX && <TLXSummary tlx={session.globalTLX} />}

              {/* Custom questions */}
              <CustomAnswers
                questions={session.project?.config?.customQuestions ?? []}
                answers={session.customAnswers ?? {}}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CustomAnswers({
  questions, answers,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questions: any[];
  answers: Record<string, string>;
}) {
  if (!questions || questions.length === 0) return null;
  const answered = questions.filter((q) => answers[q.id] != null && answers[q.id] !== "");
  if (answered.length === 0) return null;
  return (
    <div>
      <h4 className="font-bold mb-3">Additional questions</h4>
      <div className="space-y-3">
        {answered.map((q) => (
          <div key={q.id} className="p-3 bg-gray-50 rounded-xl border border-[color:var(--border)]">
            <div className="text-xs text-[color:var(--muted)] mb-1">
              {q.prompt}
              <span className="ml-2 text-[10px] uppercase tracking-wide text-[color:var(--muted)]/70">
                {q.type === "open" ? "Open" :
                 q.type === "likert" ? "Likert 1–5" :
                 q.type === "mcq-alpha" ? "MCQ (a–z)" :
                 q.type === "mcq-roman" ? "MCQ (i–x)" : q.type}
              </span>
            </div>
            <div className="text-sm font-semibold whitespace-pre-wrap break-words">
              {formatCustomAnswer(q, answers[q.id])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatCustomAnswer(q: any, raw: string): string {
  if (raw == null || raw === "") return "—";
  if (q.type === "mcq-alpha" || q.type === "mcq-roman") {
    const opts: string[] = q.options ?? [];
    const idx = parseInt(raw, 10);
    if (!Number.isNaN(idx) && opts[idx] != null) {
      const label = q.type === "mcq-alpha"
        ? String.fromCharCode(97 + idx)
        : toRoman(idx + 1).toLowerCase();
      return `${label}. ${opts[idx]}`;
    }
  }
  return String(raw);
}

function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "", v = n;
  for (const [num, sym] of map) {
    while (v >= num) { out += sym; v -= num; }
  }
  return out;
}

function AccuracyBadge({ val }: { val: number }) {
  const pct = val * 100;
  const color = pct >= 80 ? "text-emerald-700 bg-emerald-50" : pct >= 60 ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

function AggregateSummary({ blocks }: { blocks: AnySession[] }) {
  let totalHits = 0, totalMisses = 0, totalFA = 0, totalCR = 0;
  let rtVals: number[] = [];
  for (const b of blocks) {
    const m = summarize(b.trials ?? []);
    totalHits += m.hits; totalMisses += m.misses;
    totalFA += m.falseAlarms; totalCR += m.correctRejections;
    if (m.rtMean) rtVals.push(m.rtMean);
  }
  const totalResponded = totalHits + totalMisses + totalFA + totalCR;
  const overallAcc = totalResponded ? ((totalHits + totalCR) / totalResponded) * 100 : 0;
  const avgRT = rtVals.length ? rtVals.reduce((a, b) => a + b, 0) / rtVals.length : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Overall accuracy", value: `${overallAcc.toFixed(1)}%`, color: "text-indigo-700" },
        { label: "Total hits", value: totalHits, color: "text-emerald-700" },
        { label: "Total false alarms", value: totalFA, color: "text-amber-700" },
        { label: "Mean RT", value: avgRT ? `${avgRT.toFixed(0)} ms` : "—", color: "text-[color:var(--fg)]" },
      ].map((s) => (
        <div key={s.label} className="p-4 card text-center">
          <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
          <div className="text-xs text-[color:var(--muted)] mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

const TLX_LABELS: Record<string, { label: string; short: string }> = {
  mentalDemand: { label: "Mental demand", short: "MD" },
  physicalDemand: { label: "Physical demand", short: "PD" },
  temporalDemand: { label: "Temporal demand", short: "TD" },
  performance: { label: "Performance", short: "PERF" },
  effort: { label: "Effort", short: "EFF" },
  frustration: { label: "Frustration", short: "FR" },
  paasMentalEffort: { label: "Paas mental effort", short: "PAAS" },
};

function PerLevelTLX({ blocks }: { blocks: AnySession[] }) {
  const withTLX = blocks.filter((b) => b.perLevelTLX);
  if (withTLX.length === 0) return null;
  const keys = Object.keys(TLX_LABELS);
  return (
    <div>
      <h4 className="font-bold mb-3">NASA-TLX by level</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[color:var(--muted)]">
            <tr>
              <th className="py-2 pr-4">Stimulus</th>
              <th className="pr-4">Level</th>
              {keys.map((k) => (
                <th key={k} className="pr-3" title={TLX_LABELS[k].label}>{TLX_LABELS[k].short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withTLX.map((b, i) => {
              const t = b.perLevelTLX as Record<string, number>;
              return (
                <tr key={i} className="border-t border-[color:var(--border)]">
                  <td className="py-2 pr-4 capitalize">{(b.stimulusType ?? "").replace("-", " ")}</td>
                  <td className="pr-4">
                    <span className="font-mono">{b.level}-back</span>
                    {b.level === 0 && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 uppercase tracking-wide">Control</span>
                    )}
                  </td>
                  {keys.map((k) => (
                    <td key={k} className="pr-3 font-mono">{t?.[k] ?? "—"}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TLXSummary({ tlx }: { tlx: Record<string, number> }) {
  const labels: Record<string, string> = Object.fromEntries(
    Object.entries(TLX_LABELS).map(([k, v]) => [k, v.label])
  );
  return (
    <div>
      <h4 className="font-bold mb-3">Global NASA-TLX (all levels)</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(tlx).map(([k, v]) => (
          <div key={k} className="p-3 bg-gray-50 rounded-xl border border-[color:var(--border)]">
            <div className="text-xs text-[color:var(--muted)]">{labels[k] ?? k}</div>
            <div className="text-base font-bold mt-0.5">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const EDU_LABELS: Record<string, string> = {
  primary: "Primary school",
  secondary: "Secondary / high school",
  vocational: "Vocational",
  bachelors: "Bachelor's",
  masters: "Master's",
  doctorate: "Doctorate",
  other: "Other",
};

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function ResultsPage() {
  return (
    <div className="min-h-screen">
      {/* <header className="w-full px-6 md:px-10 py-4 flex items-center justify-between border-b border-[color:var(--border)] bg-white/70 backdrop-blur sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl shimmer shadow" />
          <div>
            <div className="font-bold gradient-text">Neurogauge</div>
            <div className="text-xs text-[color:var(--muted)]">Cognitive assessment platform</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/auth/login" className="btn btn-ghost text-sm">Sign in</Link>
          <Link href="/auth/signup" className="btn btn-primary text-sm">For researchers</Link>
        </div>
      </header> */}
      <main className="px-6 md:px-10 pb-16 w-full">
        <Suspense>
          <ResultsContent />
        </Suspense>
      </main>
    </div>
  );
}
