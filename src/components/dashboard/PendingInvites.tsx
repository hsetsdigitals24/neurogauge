"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mail, Building2, FolderOpen, Check } from "lucide-react";
import { notify } from "@/lib/toast";

interface ProjectInvite {
  token: string;
  projectName: string;
  invitedBy: string;
}
interface InstitutionInvite {
  token: string;
  institutionName: string;
  role: string;
  invitedBy: string;
}

// Surfaces invitations addressed to the signed-in user's email so they can be
// accepted from the dashboard — without relying on the invitation email link.
// Covers both project-collaborator and institution invites.
export function PendingInvites() {
  const router = useRouter();
  const [projectInvites, setProjectInvites] = useState<ProjectInvite[]>([]);
  const [institutionInvites, setInstitutionInvites] = useState<InstitutionInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/invites");
      if (!res.ok) return;
      const d = await res.json();
      setProjectInvites(d.projectInvites ?? []);
      setInstitutionInvites(d.institutionInvites ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function acceptProject(token: string) {
    setAccepting(token);
    try {
      const res = await fetch(`/api/invites/${token}`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify.error(d.error ?? "Could not accept invitation");
        return;
      }
      notify.success("Invitation accepted");
      setProjectInvites((l) => l.filter((i) => i.token !== token));
      if (d.projectId) router.push(`/dashboard/projects/${d.projectId}`);
      else router.refresh();
    } finally {
      setAccepting(null);
    }
  }

  async function acceptInstitution(token: string) {
    setAccepting(token);
    try {
      const res = await fetch(`/api/institution-invites/${token}`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify.error(d.error ?? "Could not accept invitation");
        return;
      }
      notify.success("Invitation accepted");
      setInstitutionInvites((l) => l.filter((i) => i.token !== token));
      if (d.institutionId) router.push(`/dashboard/institutions/${d.institutionId}`);
      else router.refresh();
    } finally {
      setAccepting(null);
    }
  }

  const total = projectInvites.length + institutionInvites.length;
  if (loading || total === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
        <Mail className="w-5 h-5 text-[color:var(--primary)]" />
        Pending invitations
        <span className="text-xs font-medium rounded-full bg-[color:var(--primary)]/10 text-[color:var(--primary)] px-2 py-0.5">
          {total}
        </span>
      </h2>
      <div className="space-y-2">
        {projectInvites.map((i) => (
          <div
            key={i.token}
            className="card p-4 flex items-center justify-between gap-3 flex-wrap"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FolderOpen className="w-5 h-5 text-[color:var(--primary)] shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{i.projectName}</p>
                <p className="text-xs text-[color:var(--muted)]">
                  Project collaboration{i.invitedBy ? ` · invited by ${i.invitedBy}` : ""}
                </p>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm inline-flex items-center gap-1.5 shrink-0"
              disabled={accepting === i.token}
              onClick={() => acceptProject(i.token)}
            >
              <Check className="w-4 h-4" /> {accepting === i.token ? "Accepting…" : "Accept"}
            </button>
          </div>
        ))}
        {institutionInvites.map((i) => (
          <div
            key={i.token}
            className="card p-4 flex items-center justify-between gap-3 flex-wrap"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Building2 className="w-5 h-5 text-[color:var(--primary)] shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{i.institutionName}</p>
                <p className="text-xs text-[color:var(--muted)]">
                  Institution membership ({i.role})
                  {i.invitedBy ? ` · invited by ${i.invitedBy}` : ""}
                </p>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm inline-flex items-center gap-1.5 shrink-0"
              disabled={accepting === i.token}
              onClick={() => acceptInstitution(i.token)}
            >
              <Check className="w-4 h-4" /> {accepting === i.token ? "Accepting…" : "Accept"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
