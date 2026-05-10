"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Copy, Check, Users, Plus, Trash2,
  ChevronDown, ChevronUp, FlaskConical, ExternalLink,
} from "lucide-react";
import { CustomQuestion, Level, SHAPE_LIBRARY, StimulusType, StudyConfig } from "@/lib/types";
import { summarize } from "@/lib/scoring";
import { generateId } from "@/lib/id";

const TYPES: { v: StimulusType; label: string }[] = [
  { v: "letters", label: "Letters" },
  { v: "shapes", label: "Shapes" },
  { v: "rotated-e", label: "Rotated E" },
];
const LEVELS: Level[] = [0, 1, 2, 3];

interface Collaborator { id: string; user: { id: string; name: string; email: string }; joinedAt: string; }
interface Invite { id: string; inviteeEmail: string; accepted: boolean; createdAt: string; token: string; }
interface Project {
  id: string; name: string; shareToken: string; config: StudyConfig;
  owner: { id: string; name: string; email: string };
  collaborators: Collaborator[];
  invites: Invite[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestSession = any;

type Tab = "overview" | "config" | "results" | "collaborators";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<StudyConfig | null>(null);
  const [projectName, setProjectName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<{ link?: string; error?: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      fetch(`/api/projects/${id}`),
      fetch(`/api/projects/${id}/sessions`),
    ]);
    if (pRes.status === 404 || pRes.status === 403) { router.push("/dashboard"); return; }
    const [pData, sData] = await Promise.all([pRes.json(), sRes.json()]);
    setProject(pData.project);
    setIsOwner(pData.isOwner);
    setCfg(pData.project.config);
    setProjectName(pData.project.name);
    setSessions(Array.isArray(sData) ? sData : []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  function update<K extends keyof StudyConfig>(k: K, v: StudyConfig[K]) {
    setCfg((c) => c ? { ...c, [k]: v } : c);
  }
  function toggleArr<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  async function saveConfig() {
    if (!cfg) return;
    setSaveStatus("saving");
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName, config: cfg }),
    });
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  async function deleteProject() {
    if (!confirm("Delete this project and all its data? This cannot be undone.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  async function copyLink() {
    if (!project) return;
    const url = `${window.location.origin}/p/${project.shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteStatus(null);
    const res = await fetch(`/api/projects/${id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteStatus({ link: data.inviteLink });
      setInviteEmail("");
      load();
    } else {
      setInviteStatus({ error: data.error });
    }
    setInviting(false);
  }

  function addQuestion() {
    if (!cfg) return;
    const q: CustomQuestion = { id: generateId(), prompt: "", type: "open", options: [] };
    update("customQuestions", [...cfg.customQuestions, q]);
  }
  function updateQ(qid: string, patch: Partial<CustomQuestion>) {
    if (!cfg) return;
    update("customQuestions", cfg.customQuestions.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  }
  function removeQ(qid: string) {
    if (!cfg) return;
    update("customQuestions", cfg.customQuestions.filter((q) => q.id !== qid));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[color:var(--muted)] text-sm">
        Loading project…
      </div>
    );
  }
  if (!project || !cfg) return null;

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/p/${project.shareToken}`
    : `/p/${project.shareToken}`;

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "config", label: "Configuration" },
    { key: "results", label: `Results (${sessions.length})` },
    { key: "collaborators", label: `Collaborators (${project.collaborators.length})` },
  ];

  return (
    <main className="min-h-screen px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">{project.name}</h1>
              <p className="text-sm text-[color:var(--muted)] mt-1">
                {isOwner ? "You own this project" : `Owned by ${project.owner.name}`}
                {" · "}Created {new Date(project.id).toLocaleDateString()}
              </p>
            </div>
            {isOwner && (
              <button onClick={deleteProject} className="btn btn-ghost text-sm text-[color:var(--danger)] flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> Delete project
              </button>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 bg-white/60 border border-[color:var(--border)] rounded-xl p-1 w-fit flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.key
                  ? "bg-white shadow text-[color:var(--fg)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--fg)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mt-6"
          >
            {/* OVERVIEW TAB */}
            {tab === "overview" && (
              <div className="space-y-5">
                {/* Share link card */}
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <ExternalLink className="w-5 h-5 text-[color:var(--primary)]" />
                    <h2 className="font-bold text-lg">Share link</h2>
                  </div>
                  <p className="text-sm text-[color:var(--muted)] mb-4">
                    Anyone with this link can take the test — no account needed.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-0 input text-sm font-mono bg-gray-50 select-all truncate flex items-center">
                      {shareUrl}
                    </div>
                    <button className="btn btn-primary flex items-center gap-2 shrink-0" onClick={copyLink}>
                      {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy link</>}
                    </button>
                    <a href={shareUrl} target="_blank" rel="noreferrer" className="btn btn-ghost flex items-center gap-1 shrink-0">
                      Preview <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Sessions", value: sessions.length },
                    { label: "Collaborators", value: project.collaborators.length },
                    { label: "Stimulus types", value: cfg.stimulusTypes.length },
                    { label: "N-back levels", value: cfg.levels.length },
                  ].map((s) => (
                    <div key={s.label} className="card p-4 text-center">
                      <div className="text-3xl font-extrabold gradient-text">{s.value}</div>
                      <div className="text-xs text-[color:var(--muted)] mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Recent sessions preview */}
                {sessions.length > 0 && (
                  <div className="card p-6">
                    <h2 className="font-bold text-lg mb-4">Recent sessions</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-[color:var(--muted)]">
                          <tr>
                            <th className="py-2 pr-4">Email</th>
                            <th className="pr-4">Age</th>
                            <th className="pr-4">Handedness</th>
                            <th className="pr-4">Blocks</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.slice(0, 5).map((s: TestSession) => (
                            <tr key={s.id} className="border-t border-[color:var(--border)]">
                              <td className="py-2 pr-4 font-mono text-xs">{s.takerEmail}</td>
                              <td className="pr-4">{s.takerAge}</td>
                              <td className="pr-4 capitalize">{s.takerHandedness}</td>
                              <td className="pr-4">{s.blocks?.length ?? 0}</td>
                              <td className="text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {sessions.length > 5 && (
                      <button className="mt-3 text-sm text-[color:var(--primary)] font-semibold"
                        onClick={() => setTab("results")}>
                        View all {sessions.length} sessions →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CONFIG TAB */}
            {tab === "config" && (
              <div className="space-y-5">
                <div className="card p-6">
                  <label className="label text-base font-bold">Project name</label>
                  <input className="input mt-1" value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    disabled={!isOwner} />
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div className="card p-6">
                    <h2 className="font-bold text-lg mb-4">Basics</h2>
                    <label className="label">Study name (shown to participants)</label>
                    <input className="input" value={cfg.studyName} disabled={!isOwner}
                      onChange={(e) => update("studyName", e.target.value)} />
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="label">Trials per block</label>
                        <input type="number" min={5} max={200} className="input" disabled={!isOwner}
                          value={cfg.trialsPerBlock}
                          onChange={(e) => update("trialsPerBlock", parseInt(e.target.value || "0"))} />
                      </div>
                      <div>
                        <label className="label">Target match rate</label>
                        <input type="number" step={0.05} min={0.1} max={0.6} className="input" disabled={!isOwner}
                          value={cfg.targetRate}
                          onChange={(e) => update("targetRate", parseFloat(e.target.value))} />
                      </div>
                    </div>
                    <label className="label mt-4">0-back target letter</label>
                    <input className="input uppercase" maxLength={1} disabled={!isOwner}
                      value={cfg.zeroBackTarget}
                      onChange={(e) => update("zeroBackTarget", e.target.value.toUpperCase().slice(0, 1) || "X")} />
                    <label className="flex items-center gap-2 mt-4 text-sm cursor-pointer">
                      <input type="checkbox" checked={cfg.collectDemographics} disabled={!isOwner}
                        onChange={(e) => update("collectDemographics", e.target.checked)} />
                      Collect additional demographics
                    </label>
                  </div>

                  <div className="card p-6">
                    <h2 className="font-bold text-lg mb-4">Timing</h2>
                    <div className="grid grid-cols-2 gap-2">
                      <button disabled={!isOwner}
                        className={`btn ${cfg.timingMode === "auto" ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => update("timingMode", "auto")}>Auto-advance</button>
                      <button disabled={!isOwner}
                        className={`btn ${cfg.timingMode === "self" ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => update("timingMode", "self")}>Self-paced</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="label">Total per screen (ms)</label>
                        <input type="number" min={500} step={100} className="input"
                          disabled={cfg.timingMode === "self" || !isOwner} value={cfg.totalMs}
                          onChange={(e) => update("totalMs", parseInt(e.target.value || "0"))} />
                      </div>
                      <div>
                        <label className="label">Stimulus display (ms)</label>
                        <input type="number" min={100} step={50} className="input"
                          disabled={cfg.timingMode === "self" || !isOwner} value={cfg.displayMs}
                          onChange={(e) => update("displayMs", parseInt(e.target.value || "0"))} />
                      </div>
                    </div>
                  </div>

                  <div className="card p-6">
                    <h2 className="font-bold text-lg mb-4">Stimulus types</h2>
                    <div className="flex flex-wrap gap-2">
                      {TYPES.map((t) => (
                        <button key={t.v} disabled={!isOwner}
                          className={`btn ${cfg.stimulusTypes.includes(t.v) ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => update("stimulusTypes", toggleArr(cfg.stimulusTypes, t.v))}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <h3 className="font-semibold mt-5 mb-2 text-sm">Shapes</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(SHAPE_LIBRARY).map((s) => (
                        <button key={s} disabled={!isOwner}
                          className={`btn text-xs ${cfg.shapes.includes(s) ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => update("shapes", toggleArr(cfg.shapes, s))}>{s}</button>
                      ))}
                    </div>
                    <h3 className="font-semibold mt-5 mb-2 text-sm">Rotated-E angles</h3>
                    <div className="flex flex-wrap gap-2">
                      {[0, 90, 180, 270].map((d) => (
                        <button key={d} disabled={!isOwner}
                          className={`btn text-xs ${cfg.rotations.includes(d) ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => update("rotations", toggleArr(cfg.rotations, d))}>{d}°</button>
                      ))}
                    </div>
                  </div>

                  <div className="card p-6">
                    <h2 className="font-bold text-lg mb-4">N-back levels</h2>
                    <div className="flex flex-wrap gap-2">
                      {LEVELS.map((l) => (
                        <button key={l} disabled={!isOwner}
                          className={`btn ${cfg.levels.includes(l) ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => update("levels", toggleArr(cfg.levels, l).sort() as Level[])}>
                          {l}-back{l === 0 ? " (control)" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Custom questions */}
                <div className="card p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-lg">Custom questions</h2>
                    {isOwner && <button className="btn btn-ghost text-sm" onClick={addQuestion}>+ Add</button>}
                  </div>
                  <div className="space-y-3 mt-4">
                    {cfg.customQuestions.length === 0 && (
                      <p className="text-sm text-[color:var(--muted)]">No custom questions added.</p>
                    )}
                    {cfg.customQuestions.map((q) => (
                      <div key={q.id} className="border border-[color:var(--border)] rounded-xl p-4">
                        <div className="grid md:grid-cols-3 gap-3">
                          <input className="input md:col-span-2" placeholder="Question prompt" disabled={!isOwner}
                            value={q.prompt} onChange={(e) => updateQ(q.id, { prompt: e.target.value })} />
                          <select className="select" value={q.type} disabled={!isOwner}
                            onChange={(e) => updateQ(q.id, { type: e.target.value as CustomQuestion["type"] })}>
                            <option value="open">Open-ended</option>
                            <option value="mcq-alpha">MCQ (a, b, c…)</option>
                            <option value="mcq-roman">MCQ (i, ii, iii…)</option>
                            <option value="likert">Likert (1–5)</option>
                          </select>
                        </div>
                        {(q.type === "mcq-alpha" || q.type === "mcq-roman") && (
                          <textarea className="textarea mt-2" rows={2} placeholder="One option per line" disabled={!isOwner}
                            value={(q.options ?? []).join("\n")}
                            onChange={(e) => updateQ(q.id, { options: e.target.value.split("\n").filter(Boolean) })} />
                        )}
                        {isOwner && (
                          <div className="text-right mt-2">
                            <button className="btn btn-ghost text-xs text-[color:var(--danger)]"
                              onClick={() => removeQ(q.id)}>Remove</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {isOwner && (
                  <div className="flex items-center gap-3">
                    <button className="btn btn-primary" onClick={saveConfig} disabled={saveStatus === "saving"}>
                      {saveStatus === "saving" ? "Saving…" : "Save changes"}
                    </button>
                    {saveStatus === "saved" && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="text-sm font-semibold text-[color:var(--success)]">✓ Saved</motion.span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* RESULTS TAB */}
            {tab === "results" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</h2>
                </div>
                {sessions.length === 0 && (
                  <div className="card p-10 text-center">
                    <FlaskConical className="w-10 h-10 mx-auto text-[color:var(--muted)] mb-3" />
                    <p className="text-[color:var(--muted)]">No sessions yet. Share the link to get started.</p>
                  </div>
                )}
                {sessions.map((s: TestSession) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    expanded={expandedSession === s.id}
                    onToggle={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                  />
                ))}
              </div>
            )}

            {/* COLLABORATORS TAB */}
            {tab === "collaborators" && (
              <div className="space-y-5">
                {isOwner && (
                  <div className="card p-6">
                    <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-[color:var(--primary)]" /> Invite collaborator
                    </h2>
                    <p className="text-sm text-[color:var(--muted)] mb-4">
                      Collaborators can view all sessions and results for this project.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <input className="input flex-1 min-w-0" type="email" placeholder="colleague@university.edu"
                        value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendInvite()} />
                      <button className="btn btn-primary shrink-0" onClick={sendInvite} disabled={inviting}>
                        {inviting ? "Sending…" : "Send invite"}
                      </button>
                    </div>
                    {inviteStatus?.link && (
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                        <p className="font-semibold text-emerald-800 mb-1">✓ Invite created. Share this link:</p>
                        <div className="flex gap-2 items-center">
                          <span className="font-mono text-xs text-emerald-700 break-all">{inviteStatus.link}</span>
                          <button className="btn btn-ghost text-xs shrink-0"
                            onClick={() => navigator.clipboard.writeText(inviteStatus.link!)}>
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-emerald-600 mt-2">
                          The invited person must have (or create) a Neurogauge account to accept.
                        </p>
                      </div>
                    )}
                    {inviteStatus?.error && (
                      <p className="mt-2 text-sm text-[color:var(--danger)]">{inviteStatus.error}</p>
                    )}
                  </div>
                )}

                {/* Current collaborators */}
                <div className="card p-6">
                  <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[color:var(--primary)]" />
                    Collaborators ({project.collaborators.length})
                  </h2>
                  {project.collaborators.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">No collaborators yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {project.collaborators.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-[color:var(--border)]">
                          <div>
                            <p className="font-semibold text-sm">{c.user.name}</p>
                            <p className="text-xs text-[color:var(--muted)]">{c.user.email}</p>
                          </div>
                          <span className="text-xs text-[color:var(--muted)]">
                            Since {new Date(c.joinedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending invites */}
                {isOwner && project.invites.filter((i) => !i.accepted).length > 0 && (
                  <div className="card p-6">
                    <h2 className="font-bold text-lg mb-4">Pending invites</h2>
                    <div className="space-y-2">
                      {project.invites.filter((i) => !i.accepted).map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200">
                          <span className="text-sm font-mono">{inv.inviteeEmail}</span>
                          <span className="text-xs text-amber-700">Pending</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main> 
  );
}

function SessionRow({ session, expanded, onToggle }: {
  session: TestSession; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      <button className="w-full p-5 flex items-start justify-between gap-4 text-left hover:bg-gray-50/50 transition-colors" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-semibold">{session.takerEmail}</span>
            <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
              {session.blocks?.length ?? 0} blocks
            </span>
          </div>
          <div className="flex gap-4 mt-1 text-xs text-[color:var(--muted)] flex-wrap">
            <span>Age: {session.takerAge}</span>
            <span>Handedness: {session.takerHandedness}</span>
            <span>Education: {session.takerEducation}</span>
            <span>{new Date(session.createdAt).toLocaleString()}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-[color:var(--muted)] shrink-0 mt-0.5" /> : <ChevronDown className="w-5 h-5 text-[color:var(--muted)] shrink-0 mt-0.5" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-[color:var(--border)]">
            <div className="p-5">
              <div className="overflow-x-auto">
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
                    {(session.blocks ?? []).map((b: TestSession, i: number) => {
                      const m = summarize(b.trials ?? []);
                      return (
                        <tr key={i} className="border-t border-[color:var(--border)]">
                          <td className="py-2 pr-4 capitalize">{b.stimulusType?.replace("-", " ")}</td>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
