"use client";
import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, X, MapPin } from "lucide-react";
import { notify } from "@/lib/toast";

type SiteLite = { id: string; name: string; code: string };

interface LinkedInstitution {
  linkId: string;
  institutionId: string;
  name: string;
  code: string;
  memberCount: number;
  site: { id: string; name: string; code: string } | null;
}

// Owner-only panel for linking collaborating institutions to a project and
// assigning each the collection site whose data it may see. Fetches its own data
// so it can drop into the project page without threading extra props.
export function ProjectInstitutions({ projectId, isOwner }: { projectId: string; isOwner: boolean }) {
  const [links, setLinks] = useState<LinkedInstitution[]>([]);
  const [sites, setSites] = useState<SiteLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [siteId, setSiteId] = useState("");
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [instRes, siteRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/institutions`),
        fetch(`/api/sites`),
      ]);
      const instData = instRes.ok ? await instRes.json() : { institutions: [] };
      const siteData = siteRes.ok ? await siteRes.json() : { sites: [] };
      setLinks(instData.institutions ?? []);
      setSites(siteData.sites ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOwner) load();
    else setLoading(false);
  }, [isOwner, load]);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/institutions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, siteId: siteId || null }),
      });
      const d = await res.json();
      if (!res.ok) {
        notify.error(d.error ?? "Could not link institution");
        return;
      }
      notify.success(`Linked ${d.link.name}`);
      setCode("");
      setSiteId("");
      setLinks((l) => [...l, d.link]);
    } finally {
      setLinking(false);
    }
  }

  async function unlink(linkId: string, name: string) {
    if (!confirm(`Unlink ${name} from this project?`)) return;
    const res = await fetch(`/api/projects/${projectId}/institutions?linkId=${linkId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      notify.error(d.error ?? "Could not unlink");
      return;
    }
    notify.success("Institution unlinked");
    setLinks((l) => l.filter((x) => x.linkId !== linkId));
  }

  if (!isOwner) return null;

  return (
    <div className="card p-6">
      <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-[color:var(--primary)]" /> Collaborating institutions
      </h2>
      <p className="text-sm text-[color:var(--muted)] mb-4">
        Link a partner institution by its code and assign the site it collects at. Their members
        sign in and see this project scoped to that site&apos;s data only.
      </p>

      <form onSubmit={link} className="flex gap-2 flex-wrap items-end mb-4">
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs text-[color:var(--muted)]">Institution code</label>
          <input
            className="input mt-1 w-full"
            placeholder="e.g. lagos-teaching-hospital"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="min-w-[160px]">
          <label className="text-xs text-[color:var(--muted)]">Assign site</label>
          <select
            className="input mt-1 w-full"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">— no site —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary shrink-0 inline-flex items-center gap-1.5" disabled={linking || !code.trim()}>
          <Plus className="w-4 h-4" /> {linking ? "Linking…" : "Link"}
        </button>
      </form>

      {sites.length === 0 && (
        <p className="text-xs text-amber-600 mb-3">
          You have no sites yet. Create one under Sites so partner institutions can be scoped to a
          centre.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[color:var(--muted)]">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">No institutions linked yet.</p>
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <div
              key={l.linkId}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-[color:var(--border)]"
            >
              <div>
                <p className="font-semibold text-sm">{l.name}</p>
                <p className="text-xs text-[color:var(--muted)] flex items-center gap-2">
                  <span className="font-mono">{l.code}</span>
                  <span>· {l.memberCount} member{l.memberCount === 1 ? "" : "s"}</span>
                  {l.site ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {l.site.name}
                    </span>
                  ) : (
                    <span className="text-amber-600">no site</span>
                  )}
                </p>
              </div>
              <button
                className="btn btn-ghost text-xs text-[color:var(--danger)] flex items-center gap-1 shrink-0"
                onClick={() => unlink(l.linkId, l.name)}
              >
                <X className="w-3.5 h-3.5" /> Unlink
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
