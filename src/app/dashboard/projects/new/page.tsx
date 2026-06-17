"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_CONFIG } from "@/lib/config";
import { CustomQuestion, Level, SHAPE_LIBRARY, StimulusType, StudyConfig } from "@/lib/types";
import { generateId } from "@/lib/id";
import { notify } from "@/lib/toast";

const TYPES: { v: StimulusType; label: string }[] = [
  { v: "letters", label: "Letters" },
  { v: "shapes", label: "Shapes" },
  { v: "rotated-e", label: "Rotated E" },
];
const LEVELS: Level[] = [0, 1, 2, 3];

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cfg, setCfg] = useState<StudyConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof StudyConfig>(k: K, v: StudyConfig[K]) {
    setCfg((c) => ({ ...c, [k]: v }));
  }
  function toggleArr<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }
  function addQuestion() {
    const id = generateId();
    const q: CustomQuestion = { id, prompt: "", type: "open", options: [] };
    update("customQuestions", [...cfg.customQuestions, q]);
  }
  function updateQ(id: string, patch: Partial<CustomQuestion>) {
    update("customQuestions", cfg.customQuestions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function removeQ(id: string) {
    update("customQuestions", cfg.customQuestions.filter((q) => q.id !== id));
  }

  async function create() {
    if (!name.trim()) { notify.error("Project name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), config: cfg }),
      });
      const data = await res.json();
      if (!res.ok) { notify.error(data.error ?? "Failed to create"); return; }
      notify.success("Project created");
      router.push(`/dashboard/projects/${data.id}`);
    } catch {
      notify.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* <header className="w-full px-6 md:px-10 py-4 flex items-center justify-between border-b border-[color:var(--border)] bg-white/70 backdrop-blur sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl shimmer shadow" />
          <span className="font-bold gradient-text">Neurogauge</span>
        </Link>
        <Link href="/dashboard" className="btn btn-ghost text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
      </header> */}

      <main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <h1 className="text-3xl md:text-4xl font-extrabold">
            New <span className="gradient-text">project</span>
          </h1>
          <p className="text-[color:var(--muted)] mt-1 text-sm">
            Configure your N-back study. You can edit everything later.
          </p>
        </motion.div>

        {/* Project name */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6 mt-6">
          <label className="label text-base font-bold">Project name</label>
          <input
            className="input mt-1"
            placeholder="e.g. Working Memory Study — Cohort A"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5 mt-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="card p-6">
            <h2 className="font-bold text-lg mb-4">Basics</h2>
            <label className="label">Study name (shown to participants)</label>
            <input className="input" value={cfg.studyName} onChange={(e) => update("studyName", e.target.value)} />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="label">Trials per block</label>
                <input type="number" min={5} max={200} className="input"
                  value={cfg.trialsPerBlock}
                  onChange={(e) => update("trialsPerBlock", parseInt(e.target.value || "0"))} />
              </div>
              <div>
                <label className="label">Target match rate</label>
                <input type="number" step={0.05} min={0.1} max={0.6} className="input"
                  value={cfg.targetRate}
                  onChange={(e) => update("targetRate", parseFloat(e.target.value))} />
              </div>
            </div>
            <label className="label mt-4">0-back target letter</label>
            <input className="input uppercase" maxLength={1} value={cfg.zeroBackTarget}
              onChange={(e) => update("zeroBackTarget", e.target.value.toUpperCase().slice(0, 1) || "X")} />
            <label className="flex items-center gap-2 mt-4 text-sm cursor-pointer">
              <input type="checkbox" checked={cfg.collectDemographics}
                onChange={(e) => update("collectDemographics", e.target.checked)} />
              Collect additional demographics
            </label>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
            <h2 className="font-bold text-lg mb-4">Timing</h2>
            <div className="grid grid-cols-2 gap-2">
              <button className={`btn ${cfg.timingMode === "auto" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => update("timingMode", "auto")}>Auto-advance</button>
              <button className={`btn ${cfg.timingMode === "self" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => update("timingMode", "self")}>Self-paced</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="label">Total per screen (ms)</label>
                <input type="number" min={500} step={100} className="input"
                  disabled={cfg.timingMode === "self"} value={cfg.totalMs}
                  onChange={(e) => update("totalMs", parseInt(e.target.value || "0"))} />
              </div>
              <div>
                <label className="label">Stimulus display (ms)</label>
                <input type="number" min={100} step={50} className="input"
                  disabled={cfg.timingMode === "self"} value={cfg.displayMs}
                  onChange={(e) => update("displayMs", parseInt(e.target.value || "0"))} />
              </div>
            </div>
            <p className="text-xs text-[color:var(--muted)] mt-2">
              Default: 3000 ms total = 500 ms display + 2500 ms response.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="card p-6">
            <h2 className="font-bold text-lg mb-4">Stimulus types</h2>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button key={t.v}
                  className={`btn ${cfg.stimulusTypes.includes(t.v) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => update("stimulusTypes", toggleArr(cfg.stimulusTypes, t.v))}>
                  {t.label}
                </button>
              ))}
            </div>
            <h3 className="font-semibold mt-5 mb-2 text-sm">Shape library</h3>
            <div className="flex flex-wrap gap-2">
              {Object.keys(SHAPE_LIBRARY).map((s) => (
                <button key={s}
                  className={`btn text-xs ${cfg.shapes.includes(s) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => update("shapes", toggleArr(cfg.shapes, s))}>
                  {s}
                </button>
              ))}
            </div>
            <h3 className="font-semibold mt-5 mb-2 text-sm">Rotated-E angles</h3>
            <div className="flex flex-wrap gap-2">
              {[0, 90, 180, 270].map((d) => (
                <button key={d}
                  className={`btn text-xs ${cfg.rotations.includes(d) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => update("rotations", toggleArr(cfg.rotations, d))}>
                  {d}°
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="card p-6">
            <h2 className="font-bold text-lg mb-4">N-back levels</h2>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button key={l}
                  className={`btn ${cfg.levels.includes(l) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => update("levels", toggleArr(cfg.levels, l).sort() as Level[])}>
                  {l}-back{l === 0 ? " (control)" : ""}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Custom questions */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="card p-6 mt-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Custom questions</h2>
            <button className="btn btn-ghost text-sm" onClick={addQuestion}>+ Add</button>
          </div>
          <div className="space-y-3 mt-4">
            {cfg.customQuestions.length === 0 && (
              <p className="text-sm text-[color:var(--muted)]">No custom questions added.</p>
            )}
            {cfg.customQuestions.map((q) => (
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
                  <textarea className="textarea mt-2" rows={2} placeholder="One option per line"
                    value={(q.options ?? []).join("\n")}
                    onChange={(e) => updateQ(q.id, { options: e.target.value.split("\n") })} />
                )}
                <div className="text-right mt-2">
                  <button className="btn btn-ghost text-xs text-[color:var(--danger)]"
                    onClick={() => removeQ(q.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex gap-3 mt-8">
          <button className="btn btn-primary" onClick={create} disabled={saving}>
            {saving ? "Creating…" : "Create project →"}
          </button>
          <Link href="/dashboard" className="btn btn-ghost">Cancel</Link>
        </div>
      </main>
    </div>
  );
}
