"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mail, Building2, FolderOpen, Check, X, ChevronRight } from "lucide-react";
import { notify } from "@/lib/toast";

interface ProjectInvite {
  token: string;
  projectName: string;
  invitedBy: string;
  invitedByEmail: string;
  inviteeEmail: string;
  createdAt: string;
}
interface InstitutionInvite {
  token: string;
  institutionName: string;
  role: string;
  invitedBy: string;
  invitedByEmail: string;
  inviteeEmail: string;
  createdAt: string;
}

// A single invite normalised for the details popup, regardless of kind.
type SelectedInvite =
  | ({ kind: "project" } & ProjectInvite)
  | ({ kind: "institution" } & InstitutionInvite);

// Surfaces invitations addressed to the signed-in user's email so they can be
// reviewed from the dashboard — without relying on the invitation email link.
// Clicking an invite opens a details popup to accept or decline it.
// Covers both project-collaborator and institution invites.
export function PendingInvites() {
  const router = useRouter();
  const [projectInvites, setProjectInvites] = useState<ProjectInvite[]>([]);
  const [institutionInvites, setInstitutionInvites] = useState<InstitutionInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedInvite | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

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

  const closePopup = useCallback(() => {
    if (busy) return;
    setSelected(null);
  }, [busy]);

  // Close on Escape while the popup is open.
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePopup();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, closePopup]);

  function dropFromList(inv: SelectedInvite) {
    if (inv.kind === "project") {
      setProjectInvites((l) => l.filter((i) => i.token !== inv.token));
    } else {
      setInstitutionInvites((l) => l.filter((i) => i.token !== inv.token));
    }
  }

  async function accept(inv: SelectedInvite) {
    setBusy("accept");
    try {
      const url =
        inv.kind === "project"
          ? `/api/invites/${inv.token}`
          : `/api/institution-invites/${inv.token}`;
      const res = await fetch(url, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify.error(d.error ?? "Could not accept invitation");
        return;
      }
      notify.success("Invitation accepted");
      dropFromList(inv);
      setSelected(null);
      if (inv.kind === "project" && d.projectId) router.push(`/dashboard/projects/${d.projectId}`);
      else if (inv.kind === "institution" && d.institutionId) router.push(`/dashboard/institutions/${d.institutionId}`);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function decline(inv: SelectedInvite) {
    setBusy("decline");
    try {
      const url =
        inv.kind === "project"
          ? `/api/invites/${inv.token}`
          : `/api/institution-invites/${inv.token}`;
      const res = await fetch(url, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify.error(d.error ?? "Could not decline invitation");
        return;
      }
      notify.success("Invitation declined");
      dropFromList(inv);
      setSelected(null);
    } finally {
      setBusy(null);
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
          <button
            key={i.token}
            className="card p-4 w-full flex items-center justify-between gap-3 text-left hover:border-[color:var(--primary)]/40 transition-colors"
            onClick={() => setSelected({ kind: "project", ...i })}
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
            <span className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1 shrink-0">
              View <ChevronRight className="w-4 h-4" />
            </span>
          </button>
        ))}
        {institutionInvites.map((i) => (
          <button
            key={i.token}
            className="card p-4 w-full flex items-center justify-between gap-3 text-left hover:border-[color:var(--primary)]/40 transition-colors"
            onClick={() => setSelected({ kind: "institution", ...i })}
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
            <span className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1 shrink-0">
              View <ChevronRight className="w-4 h-4" />
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <InviteDetailsPopup
          invite={selected}
          busy={busy}
          onClose={closePopup}
          onAccept={() => accept(selected)}
          onDecline={() => decline(selected)}
        />
      )}
    </section>
  );
}

function InviteDetailsPopup({
  invite,
  busy,
  onClose,
  onAccept,
  onDecline,
}: {
  invite: SelectedInvite;
  busy: "accept" | "decline" | null;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const isProject = invite.kind === "project";
  const title = isProject ? invite.projectName : invite.institutionName;
  const sentOn = invite.createdAt
    ? new Date(invite.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const rows: { label: string; value: string }[] = [
    { label: "Type", value: isProject ? "Project collaboration" : "Institution membership" },
    ...(isProject
      ? [{ label: "Project", value: invite.projectName }]
      : [
          { label: "Institution", value: invite.institutionName },
          { label: "Role", value: invite.role },
        ]),
    { label: "Invited by", value: invite.invitedByEmail || invite.invitedBy || "—" },
    { label: "Sent to", value: invite.inviteeEmail },
    ...(sentOn ? [{ label: "Sent on", value: sentOn }] : []),
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-md p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--primary)]/10">
            {isProject ? (
              <FolderOpen className="w-5 h-5 text-[color:var(--primary)]" />
            ) : (
              <Building2 className="w-5 h-5 text-[color:var(--primary)]" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)]">
              Invitation
            </span>
            <h3 className="font-bold text-base truncate">{title}</h3>
          </div>
          <button
            className="btn btn-ghost p-1 text-[color:var(--muted)]"
            onClick={onClose}
            disabled={!!busy}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <dl className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-3 text-sm">
              <dt className="text-[color:var(--muted)] shrink-0">{r.label}</dt>
              <dd className="font-medium text-right break-words min-w-0">{r.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-[color:var(--muted)]">
          {isProject
            ? "Accepting adds this project to your dashboard as a collaborator."
            : "Accepting adds you as a member of this institution."}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="btn btn-ghost border border-[color:var(--border)] inline-flex items-center gap-1.5"
            onClick={onDecline}
            disabled={!!busy}
          >
            <X className="w-4 h-4" /> {busy === "decline" ? "Declining…" : "Decline"}
          </button>
          <button
            className="btn btn-primary inline-flex items-center gap-1.5"
            onClick={onAccept}
            disabled={!!busy}
            autoFocus
          >
            <Check className="w-4 h-4" /> {busy === "accept" ? "Accepting…" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
