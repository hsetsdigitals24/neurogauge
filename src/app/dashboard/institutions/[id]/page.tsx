"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  ArrowLeft,
  Users,
  FolderOpen,
  CheckCircle,
  UserPlus,
  Copy,
  Trash2,
  MapPin,
  LogOut,
} from "lucide-react";
import { notify } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

type Role = "owner" | "admin" | "member";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  isSelf: boolean;
}
interface Invite {
  id: string;
  inviteeEmail: string;
  role: Role;
}
interface ProjectRow {
  linkId: string;
  projectId: string;
  projectName: string;
  shareToken: string;
  kind: "nback" | "questionnaire";
  site: { id: string; name: string; code: string } | null;
  participants: number;
  completed: number;
  lastActivity: string | null;
}
interface Data {
  institution: { id: string; name: string; code: string };
  myRole: Role;
  isManager: boolean;
  members: Member[];
  invites: Invite[];
  projects: ProjectRow[];
  totals: { projects: number; participants: number; completed: number };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-[color:var(--muted)] mt-0.5">{label}</div>
    </div>
  );
}

export default function InstitutionDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/institutions/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/institutions/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const d = await res.json();
      if (!res.ok) {
        notify.error(d.error ?? "Could not send invite");
        return;
      }
      if (d.emailSent) notify.success(`Invitation sent to ${inviteEmail}`);
      else notify.success("Invite created — copy the link to share it");
      setInviteEmail("");
      load();
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(memberId: string, self: boolean) {
    if (
      !(await confirmDialog(
        self
          ? { title: "Leave institution", message: "Leave this institution?", confirmLabel: "Leave" }
          : { title: "Remove member", message: "Remove this member?", confirmLabel: "Remove" }
      ))
    )
      return;
    const res = await fetch(`/api/institutions/${id}/members?memberId=${memberId}`, {
      method: "DELETE",
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify.error(d.error ?? "Could not remove member");
      return;
    }
    if (self) {
      notify.success("You left the institution");
      router.push("/dashboard/institutions");
      return;
    }
    notify.success("Member removed");
    load();
  }

  async function deleteInstitution() {
    if (!(await confirmDialog({ title: "Delete institution", message: "Delete this institution? This cannot be undone.", confirmLabel: "Delete" }))) return;
    const res = await fetch(`/api/institutions/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify.error(d.error ?? "Could not delete");
      return;
    }
    notify.success("Institution deleted");
    router.push("/dashboard/institutions");
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => notify.success("Copied"),
      () => notify.error("Could not copy")
    );
  }

  if (loading) {
    return (
      <main className="px-6 md:px-10 max-w-5xl mx-auto">
        <div className="text-center text-[color:var(--muted)] text-sm py-20">Loading…</div>
      </main>
    );
  }
  if (notFound || !data) {
    return (
      <main className="px-6 md:px-10 max-w-5xl mx-auto">
        <div className="card p-10 text-center mt-16">
          <h1 className="text-xl font-extrabold">Institution not found</h1>
          <p className="text-sm text-[color:var(--muted)] mt-2">
            It may have been deleted, or you&apos;re not a member.
          </p>
          <Link href="/dashboard/institutions" className="btn btn-primary mt-4">
            Back to institutions
          </Link>
        </div>
      </main>
    );
  }

  const inst = data.institution;

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full">
        <Link
          href="/dashboard/institutions"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
        >
          <ArrowLeft className="w-4 h-4" /> Institutions
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold">{inst.name}</h1>
            <p className="text-xs text-[color:var(--muted)]">
              code: <span className="font-mono">{inst.code}</span> · your role: {data.myRole}
            </p>
          </div>
        </motion.div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <Stat label="Co-worked projects" value={data.totals.projects} />
          <Stat label="Your participants" value={data.totals.participants} />
          <Stat label="Completed" value={data.totals.completed} />
        </div>

        {/* Co-worked projects */}
        <section className="mt-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[color:var(--primary)]" /> Projects you co-work on
          </h2>
          {data.projects.length === 0 ? (
            <div className="card p-8 text-center text-[color:var(--muted)] text-sm">
              No projects yet. A study lead links your institution to their project using your
              code <span className="font-mono">{inst.code}</span>.
            </div>
          ) : (
            <div className="space-y-3">
              {data.projects.map((p) => {
                const collectLink = p.site
                  ? `${origin}/p/${p.shareToken}?site=${p.site.code}`
                  : null;
                return (
                  <div key={p.linkId} className="card p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="font-bold">{p.projectName}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[color:var(--muted)]">
                          <span className="px-2 py-0.5 rounded-full bg-[color:var(--muted)]/10">
                            {p.kind === "questionnaire" ? "Questionnaire" : "N-back"}
                          </span>
                          {p.site ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" /> {p.site.name}
                            </span>
                          ) : (
                            <span className="text-amber-600">No site assigned yet</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-bold">
                          {p.participants}{" "}
                          <span className="font-normal text-[color:var(--muted)]">at your site</span>
                        </div>
                        <div className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1 justify-end">
                          <CheckCircle className="w-3.5 h-3.5 text-[color:var(--success)]" />
                          {p.completed} completed
                        </div>
                      </div>
                    </div>
                    {collectLink && (
                      <div className="mt-3 flex items-center gap-2">
                        <code className="text-[11px] bg-[color:var(--muted)]/10 rounded px-2 py-1 truncate flex-1">
                          {collectLink}
                        </code>
                        <button
                          onClick={() => copy(collectLink)}
                          className="btn btn-ghost btn-sm inline-flex items-center gap-1 border border-[color:var(--border)]"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy collect link
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Members */}
        <section className="mt-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-[color:var(--primary)]" /> Members
          </h2>

          {data.isManager && (
            <form onSubmit={invite} className="card p-4 mb-4 flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-[color:var(--muted)]">Invite by email</label>
                <input
                  type="email"
                  className="input mt-1 w-full"
                  placeholder="colleague@institution.org"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary inline-flex items-center gap-1.5"
                disabled={inviting || !inviteEmail.trim()}
              >
                <UserPlus className="w-4 h-4" /> {inviting ? "Sending…" : "Invite"}
              </button>
            </form>
          )}

          <div className="card divide-y divide-[color:var(--border)]">
            {data.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <div className="font-medium text-sm">
                    {m.name} {m.isSelf && <span className="text-[color:var(--muted)]">(you)</span>}
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">{m.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[color:var(--muted)]/10 text-[color:var(--muted)] capitalize">
                    {m.role}
                  </span>
                  {m.isSelf && m.role !== "owner" && (
                    <button
                      onClick={() => removeMember(m.id, true)}
                      className="text-[color:var(--muted)] hover:text-[color:var(--danger)]"
                      title="Leave institution"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                  {!m.isSelf && data.isManager && m.role !== "owner" && (
                    <button
                      onClick={() => removeMember(m.id, false)}
                      className="text-[color:var(--muted)] hover:text-[color:var(--danger)]"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {data.isManager && data.invites.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-wide mb-2">
                Pending invites
              </h3>
              <div className="card divide-y divide-[color:var(--border)]">
                {data.invites.map((iv) => (
                  <div key={iv.id} className="flex items-center justify-between p-3 text-sm">
                    <span>{iv.inviteeEmail}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Danger zone */}
        {data.myRole === "owner" && (
          <section className="mt-12">
            <button
              onClick={deleteInstitution}
              className="btn btn-ghost text-[color:var(--danger)] border border-[color:var(--border)] inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Delete institution
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
