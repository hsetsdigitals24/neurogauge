"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Header } from "@/components/Header";
import { DEFAULT_CONFIG, loadConfig, saveConfig } from "@/lib/store";
import { CustomQuestion, Level, SHAPE_LIBRARY, StimulusType, StudyConfig } from "@/lib/types";

const TYPES: { v: StimulusType; label: string }[] = [
  { v: "letters", label: "Letters" },
  { v: "shapes", label: "Shapes" },
  { v: "rotated-e", label: "Rotated E" },
];

const LEVELS: Level[] = [0, 1, 2, 3];

export default function AdminPage() {
  const [cfg, setCfg] = useState<StudyConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setCfg(loadConfig()); }, []);

  function update<K extends keyof StudyConfig>(k: K, v: StudyConfig[K]) {
    setCfg((c) => ({ ...c, [k]: v }));
  }

  function toggleArr<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  function save() {
    saveConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function reset() {
    setCfg(DEFAULT_CONFIG);
    saveConfig(DEFAULT_CONFIG);
  }

  function addQuestion() {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "q_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const q: CustomQuestion = { id, prompt: "", type: "open", options: [] };
    update("customQuestions", [...cfg.customQuestions, q]);
  }
  function updateQ(id: string, patch: Partial<CustomQuestion>) {
    update("customQuestions", cfg.customQuestions.map(q => q.id === id ? { ...q, ...patch } : q));
  }
  function removeQ(id: string) {
    update("customQuestions", cfg.customQuestions.filter(q => q.id !== id));
  }

  return (
    <>
      <Header />
      <main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full">
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-extrabold mt-6"
        >
          Study <span className="gradient-text">Configuration</span>
        </motion.h1>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-[color:var(--muted)] mt-1">Settings persist locally on this device.</p>
          <Link href="/admin/sessions" className="btn btn-ghost text-sm">View saved sessions →</Link>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mt-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            <h2 className="font-bold text-lg mb-4">Basics</h2>
            <label className="label">Study name</label>
            <input className="input" value={cfg.studyName}
              onChange={(e) => update("studyName", e.target.value)} />

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="label">Trials per block</label>
                <input type="number" min={5} max={200} className="input"
                  value={cfg.trialsPerBlock}
                  onChange={(e) => update("trialsPerBlock", parseInt(e.target.value || "0"))} />
              </div>
              <div>
                <label className="label">Target rate (matches)</label>
                <input type="number" step={0.05} min={0.1} max={0.6} className="input"
                  value={cfg.targetRate}
                  onChange={(e) => update("targetRate", parseFloat(e.target.value))} />
              </div>
            </div>

            <label className="label mt-4">0-back target letter</label>
            <input className="input uppercase" maxLength={1} value={cfg.zeroBackTarget}
              onChange={(e) => update("zeroBackTarget", e.target.value.toUpperCase().slice(0,1) || "X")} />

            <label className="flex items-center gap-2 mt-4 text-sm">
              <input type="checkbox" checked={cfg.collectDemographics}
                onChange={(e) => update("collectDemographics", e.target.checked)} />
              Collect demographics (age, gender, handedness, education)
            </label>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
            <h2 className="font-bold text-lg mb-4">Timing</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`btn ${cfg.timingMode === "auto" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => update("timingMode", "auto")}>Auto-advance</button>
              <button
                className={`btn ${cfg.timingMode === "self" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => update("timingMode", "self")}>Self-paced</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="label">Total per screen (ms)</label>
                <input type="number" min={500} step={100} className="input"
                  disabled={cfg.timingMode === "self"}
                  value={cfg.totalMs}
                  onChange={(e) => update("totalMs", parseInt(e.target.value || "0"))} />
              </div>
              <div>
                <label className="label">Stimulus display (ms)</label>
                <input type="number" min={100} step={50} className="input"
                  disabled={cfg.timingMode === "self"}
                  value={cfg.displayMs}
                  onChange={(e) => update("displayMs", parseInt(e.target.value || "0"))} />
              </div>
            </div>
            <p className="text-xs text-[color:var(--muted)] mt-2">
              Default 3000 ms = 500 ms display + 2500 ms response. In self-paced mode, the participant clicks Yes / No / Next.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
            <h2 className="font-bold text-lg mb-4">Stimulus types</h2>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(t => (
                <button key={t.v}
                  className={`btn ${cfg.stimulusTypes.includes(t.v) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => update("stimulusTypes", toggleArr(cfg.stimulusTypes, t.v))}>
                  {t.label}
                </button>
              ))}
            </div>

            <h3 className="font-semibold mt-5 mb-2 text-sm">Shape library</h3>
            <div className="flex flex-wrap gap-2">
              {Object.keys(SHAPE_LIBRARY).map(s => (
                <button key={s}
                  className={`btn text-xs ${cfg.shapes.includes(s) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => update("shapes", toggleArr(cfg.shapes, s))}>
                  {s}
                </button>
              ))}
            </div>

            <h3 className="font-semibold mt-5 mb-2 text-sm">Rotated-E angles</h3>
            <div className="flex flex-wrap gap-2">
              {[0, 90, 180, 270].map(d => (
                <button key={d}
                  className={`btn text-xs ${cfg.rotations.includes(d) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => update("rotations", toggleArr(cfg.rotations, d))}>
                  {d}°
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-6">
            <h2 className="font-bold text-lg mb-4">N-back levels</h2>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map(l => (
                <button key={l}
                  className={`btn ${cfg.levels.includes(l) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => update("levels", toggleArr(cfg.levels, l).sort() as Level[])}>
                  {l}-back{l === 0 ? " (control)" : ""}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6 mt-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Custom questions</h2>
            <button className="btn btn-ghost text-sm" onClick={addQuestion}>+ Add</button>
          </div>
          <div className="space-y-3 mt-4">
            {cfg.customQuestions.length === 0 && (
              <p className="text-sm text-[color:var(--muted)]">No custom questions added.</p>
            )}
            {cfg.customQuestions.map(q => (
              <div key={q.id} className="border border-[color:var(--border)] rounded-xl p-4">
                <div className="grid md:grid-cols-3 gap-3">
                  <input className="input md:col-span-2" placeholder="Question prompt"
                    value={q.prompt} onChange={(e) => updateQ(q.id, { prompt: e.target.value })} />
                  <select className="select" value={q.type}
                    onChange={(e) => updateQ(q.id, { type: e.target.value as CustomQuestion["type"] })}>
                    <option value="open">Open-ended</option>
                    <option value="mcq-alpha">MCQ (a, b, c…)</option>
                    <option value="mcq-roman">MCQ (i, ii, iii…)</option>
                    <option value="likert">Likert (1–5)</option>
                  </select>
                </div>
                {(q.type === "mcq-alpha" || q.type === "mcq-roman") && (
                  <textarea className="textarea mt-2" rows={2}
                    placeholder="One option per line"
                    value={(q.options ?? []).join("\n")}
                    onChange={(e) => updateQ(q.id, { options: e.target.value.split("\n").filter(Boolean) })} />
                )}
                <div className="text-right mt-2">
                  <button className="btn btn-ghost text-xs text-[color:var(--danger)]"
                    onClick={() => removeQ(q.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex items-center gap-3 mt-8">
          <button className="btn btn-primary" onClick={save}>Save configuration</button>
          <button className="btn btn-ghost" onClick={reset}>Reset to defaults</button>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className="text-sm font-semibold text-[color:var(--success)]">
              ✓ Saved
            </motion.span>
          )}
        </div>
      </main>
    </>
  );
}
