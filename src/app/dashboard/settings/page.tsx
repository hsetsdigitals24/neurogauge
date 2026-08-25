"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, User as UserIcon, Lock, CreditCard, Sparkles, Loader2 } from "lucide-react";
import { notify } from "@/lib/toast";

interface Account {
  id: string;
  email: string;
  name: string;
  accountType: "student" | "institution" | "research_group";
  isAdmin?: boolean;
  aiCredits?: number;
  projectCredits?: number;
  createdAt: string;
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  student: "Student",
  institution: "Institution",
  research_group: "Research group",
};

export default function SettingsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user) { setAccount(d.user); setName(d.user.name); } })
      .finally(() => setLoading(false));
  }, []);

  async function saveName() {
    if (!name.trim()) { notify.error("Name can't be empty"); return; }
    setSavingName(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not save"); return; }
      setAccount((a) => (a ? { ...a, name: d.user.name } : a));
      notify.success("Profile updated");
    } catch { notify.error("Network error"); } finally { setSavingName(false); }
  }

  async function changePassword() {
    if (newPassword.length < 8) { notify.error("New password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { notify.error("New passwords don't match"); return; }
    setSavingPw(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not change password"); return; }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      notify.success("Password changed");
    } catch { notify.error("Network error"); } finally { setSavingPw(false); }
  }

  if (loading) {
    return <div className="min-h-screen"><main className="px-6 md:px-10 pb-20 max-w-2xl mx-auto w-full"><div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div></main></div>;
  }
  if (!account) {
    return <div className="min-h-screen"><main className="px-6 md:px-10 pb-20 max-w-2xl mx-auto w-full"><div className="mt-10 text-center">You&apos;re not signed in. <Link className="text-indigo-600" href="/auth/login">Sign in</Link></div></main></div>;
  }

  const memberSince = new Date(account.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-2xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)]">Account</span>
            <h1 className="text-2xl md:text-3xl font-extrabold">Profile &amp; settings</h1>
          </div>
        </div>

        {/* Profile */}
        <section className="mt-6 card p-6">
          <h2 className="font-bold">Profile</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Email</label>
                <input className="input bg-slate-50" value={account.email} disabled />
                <p className="text-[11px] text-[color:var(--muted)] mt-1">Email can&apos;t be changed here.</p>
              </div>
              <div>
                <label className="label">Account type</label>
                <div className="input bg-slate-50 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                    {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}
                  </span>
                  {account.isAdmin && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Admin</span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-[color:var(--muted)]">Member since {memberSince}</p>
            <div>
              <button className="btn btn-primary" disabled={savingName || name.trim() === account.name} onClick={saveName}>
                {savingName ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save changes"}
              </button>
            </div>
          </div>
        </section>

        {/* Password */}
        <section className="mt-6 card p-6">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[color:var(--muted)]" />
            <h2 className="font-bold">Change password</h2>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label">Current password</label>
              <input className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">New password</label>
                <input className="input" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-[color:var(--muted)]">At least 8 characters.</p>
            <div>
              <button className="btn btn-primary" disabled={savingPw || !currentPassword || !newPassword} onClick={changePassword}>
                {savingPw ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</> : "Update password"}
              </button>
            </div>
          </div>
        </section>

        {/* Billing / credits quick links */}
        <section className="mt-6 card p-6">
          <h2 className="font-bold">Billing &amp; credits</h2>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <Link href="/dashboard/billing" className="rounded-xl border border-[color:var(--border)] p-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
              <div className="flex items-center gap-2 font-semibold text-sm"><CreditCard className="w-4 h-4 text-indigo-600" /> Plans &amp; subscription</div>
              <p className="text-xs text-[color:var(--muted)] mt-1">Manage your plan and one-off purchases.</p>
            </Link>
            <Link href="/dashboard/billing" className="rounded-xl border border-[color:var(--border)] p-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
              <div className="flex items-center gap-2 font-semibold text-sm"><Sparkles className="w-4 h-4 text-indigo-600" /> AI credits{typeof account.aiCredits === "number" ? ` · ${account.aiCredits}` : ""}</div>
              <p className="text-xs text-[color:var(--muted)] mt-1">Buy AI analysis credits used by the AI Statistician.</p>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
