"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import {
  StudyConfig, QItem, QuestionnaireConfig, isQuestionnaireConfig, CustomQuestion,
} from "@/lib/types";

const STIM_LABEL: Record<string, string> = {
  letters: "Letters", shapes: "Shapes", "rotated-e": "Rotated E",
};

/**
 * Printable paper form for offline data collection.
 *  - Questionnaire projects → a fill-in questionnaire (consent + questions).
 *  - N-back projects → a paper recording sheet for the researcher to transcribe
 *    in-person session metrics, TLX and custom answers, later uploaded via the
 *    project's Collect → Upload tab.
 */
export default function PrintFormPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [name, setName] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [config, setConfig] = useState<any>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");

  useEffect(() => {
    fetch(`/api/public/${shareToken}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) { setState("notfound"); return; }
        setName(data.name);
        setConfig(data.config);
        setState("ready");
      })
      .catch(() => setState("notfound"));
  }, [shareToken]);

  if (state === "loading") {
    return <div className="p-10 text-center text-sm text-[color:var(--muted)]">Loading…</div>;
  }
  if (state === "notfound") {
    return <div className="p-10 text-center text-sm text-[color:var(--muted)]">Form not found.</div>;
  }

  const isQ = isQuestionnaireConfig(config);

  return (
    <main className="print-sheet mx-auto w-full max-w-3xl px-6 md:px-10 py-8 text-[color:var(--fg)]">
      {/* Toolbar — hidden when printing */}
      <div className="no-print mb-6 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-[color:var(--muted)]">
          Print this page, collect responses on paper, then upload the results back into the project.
        </p>
        <button className="btn btn-primary flex items-center gap-2" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <header className="mb-6 border-b border-gray-300 pb-4">
        <h1 className="text-2xl font-extrabold">{name}</h1>
        <p className="text-sm text-[color:var(--muted)] mt-1">
          {isQ ? "Questionnaire — paper form" : "N-back session — recording sheet"}
        </p>
      </header>

      {/* Respondent identity line */}
      <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <FillLine label="Email" />
        <FillLine label="Date" />
        {!isQ && <>
          <FillLine label="Age" />
          <FillLine label="Handedness" />
          <FillLine label="Education" />
          <FillLine label="Participant ID" />
        </>}
      </div>

      {isQ
        ? <QuestionnaireSheet config={config as QuestionnaireConfig} />
        : <NBackSheet config={config as StudyConfig} />}

      <footer className="mt-10 pt-4 border-t border-gray-300 text-xs text-[color:var(--muted)]">
        Neurogauge · Offline collection form. Enter these responses under the project&apos;s Collect → Upload tab.
      </footer>
    </main>
  );
}

function FillLine({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-2">
      <span className="font-semibold whitespace-nowrap">{label}:</span>
      <span className="flex-1 border-b border-gray-400 h-5" />
    </div>
  );
}

/* ── Questionnaire paper form ─────────────────────────────── */
function QuestionnaireSheet({ config }: { config: QuestionnaireConfig }) {
  const questions = config.questions ?? [];
  return (
    <div>
      {(config.consentText || config.description) && (
        <div className="mb-6 text-sm space-y-2 leading-relaxed">
          {config.consentText && <p>{config.consentText}</p>}
          {config.description && <p className="text-[color:var(--muted)]"><strong>About:</strong> {config.description}</p>}
        </div>
      )}
      <ol className="space-y-6">
        {questions.map((q, i) => (
          <li key={q.id} className="break-inside-avoid">
            <p className="font-semibold text-sm">
              <span className="text-[color:var(--muted)] mr-1">{i + 1}.</span>
              {q.prompt || "(no prompt)"}
              {q.required && <span className="text-[color:var(--danger)] ml-1">*</span>}
            </p>
            <div className="mt-2">
              <QItemAnswerArea q={q} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function QItemAnswerArea({ q }: { q: QItem }) {
  const points = q.scalePoints ?? 5;
  if (q.type === "open") {
    return <div className="space-y-4 pt-1">{[0, 1, 2].map((n) => <div key={n} className="border-b border-gray-300 h-5" />)}</div>;
  }
  if (q.type === "numeric") {
    return <div className="inline-block w-40 border-b border-gray-400 h-6" />;
  }
  if (q.type === "likert") {
    return (
      <div className="flex gap-4 flex-wrap text-sm">
        {Array.from({ length: points }, (_, i) => i + 1).map((n) => (
          <span key={n} className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 border border-gray-500 rounded-full" /> {n}
          </span>
        ))}
        {q.scaleLabels && (
          <span className="text-xs text-[color:var(--muted)] w-full">
            {q.scaleLabels.min} → {q.scaleLabels.max}
          </span>
        )}
      </div>
    );
  }
  // single / multi
  return (
    <div className="space-y-1.5 text-sm">
      {(q.options ?? []).filter(Boolean).map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={`inline-block w-4 h-4 border border-gray-500 ${q.type === "single" ? "rounded-full" : "rounded"}`} />
          <span>{o}</span>
        </div>
      ))}
    </div>
  );
}

/* ── N-back recording sheet ───────────────────────────────── */
function NBackSheet({ config }: { config: StudyConfig }) {
  const stims = config.stimulusTypes ?? [];
  const levels = config.levels ?? [];
  const grid: { type: string; level: number }[] = [];
  for (const t of stims) for (const l of levels) grid.push({ type: t, level: l });
  const custom: CustomQuestion[] = config.customQuestions ?? [];

  return (
    <div className="space-y-8">
      <section className="break-inside-avoid">
        <h2 className="font-bold text-sm mb-2">Performance by block</h2>
        <table className="w-full text-xs border border-gray-400 border-collapse">
          <thead>
            <tr className="text-left">
              {["Stimulus", "Level", "Accuracy", "d′", "Hits", "Misses", "False alarms", "RT mean (ms)"].map((h) => (
                <th key={h} className="border border-gray-400 px-2 py-1 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(grid.length ? grid : [{ type: "", level: 0 }]).map((g, i) => (
              <tr key={i}>
                <td className="border border-gray-400 px-2 py-2">{STIM_LABEL[g.type] ?? ""}</td>
                <td className="border border-gray-400 px-2 py-2">{g.type ? `${g.level}-back` : ""}</td>
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="border border-gray-400 px-2 py-2">&nbsp;</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="break-inside-avoid">
        <h2 className="font-bold text-sm mb-2">NASA-TLX (0–100; Paas 1–9)</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {["Mental demand", "Physical demand", "Temporal demand", "Performance", "Effort", "Frustration", "Paas mental effort (1–9)"].map((d) => (
            <FillLine key={d} label={d} />
          ))}
        </div>
      </section>

      {custom.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="font-bold text-sm mb-2">Additional questions</h2>
          <ol className="space-y-4">
            {custom.map((q, i) => (
              <li key={q.id}>
                <p className="font-semibold text-sm">
                  <span className="text-[color:var(--muted)] mr-1">{i + 1}.</span>{q.prompt || "(no prompt)"}
                </p>
                {(q.type === "mcq-alpha" || q.type === "mcq-roman") ? (
                  <div className="space-y-1.5 text-sm mt-1">
                    {(q.options ?? []).filter(Boolean).map((o, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <span className="inline-block w-4 h-4 border border-gray-500 rounded-full" />
                        <span>{o}</span>
                      </div>
                    ))}
                  </div>
                ) : q.type === "likert" ? (
                  <div className="flex gap-4 mt-1 text-sm">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className="flex items-center gap-1">
                        <span className="inline-block w-4 h-4 border border-gray-500 rounded-full" /> {n}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="border-b border-gray-300 h-5 mt-2" />
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
