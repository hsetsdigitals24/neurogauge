"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notify } from "@/lib/toast";

interface Profile {
  id: string;
  headline: string;
  bio: string;
  expertise: string[];
  hourlyRateKobo: number;
  yearsExperience: number | null;
  status: string;
  payoutBankCode: string | null;
  payoutAccountNumber: string | null;
  payoutAccountName: string | null;
}

const STATUS_COPY: Record<string, string> = {
  pending: "Your application is under review. You'll be listed once approved.",
  approved: "You're live! Clients can find and book you.",
  rejected: "Your application wasn't approved. You can edit and resubmit.",
  suspended: "Your profile is suspended. Contact support.",
};

export default function BecomeConsultantPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState("");
  const [hourlyRateNaira, setRate] = useState("");
  const [yearsExperience, setYears] = useState("");
  const [payoutBankCode, setBank] = useState("");
  const [payoutAccountNumber, setAcct] = useState("");
  const [payoutAccountName, setAcctName] = useState("");

  useEffect(() => {
    fetch("/api/marketplace/consultants/me")
      .then((r) => (r.ok ? r.json() : { profile: null }))
      .then((d) => {
        const p: Profile | null = d.profile;
        setProfile(p);
        if (p) {
          setHeadline(p.headline); setBio(p.bio); setExpertise(p.expertise.join(", "));
          setRate(String(p.hourlyRateKobo / 100)); setYears(p.yearsExperience?.toString() ?? "");
          setBank(p.payoutBankCode ?? ""); setAcct(p.payoutAccountNumber ?? ""); setAcctName(p.payoutAccountName ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/marketplace/consultants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline, bio, expertise, hourlyRateNaira, yearsExperience,
          payoutBankCode, payoutAccountNumber, payoutAccountName,
        }),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not save"); return; }
      setProfile(d.profile);
      notify.success("Profile submitted for review");
    } catch {
      notify.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-2xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/consulting" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Marketplace
          </Link>
        </div>
        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">Become a consultant</h1>
        <p className="text-sm text-[color:var(--muted)] mt-1">Offer paid statistical consulting to researchers on Neurogauge.</p>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : (
          <>
            {profile && (
              <div className="mt-6 card p-4 text-sm">
                Status: <span className="font-bold capitalize">{profile.status}</span> — {STATUS_COPY[profile.status]}
              </div>
            )}

            <div className="mt-6 card p-6 space-y-4">
              <div>
                <label className="label">Headline</label>
                <input className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Biostatistician — mixed models & SEM" />
              </div>
              <div>
                <label className="label">Bio</label>
                <textarea className="input min-h-[120px]" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Your background, methods you specialise in, how you help." />
              </div>
              <div>
                <label className="label">Expertise (comma-separated)</label>
                <input className="input" value={expertise} onChange={(e) => setExpertise(e.target.value)} placeholder="ANOVA, Regression, SEM, R, SPSS" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Hourly rate (₦)</label>
                  <input className="input" type="number" min={0} value={hourlyRateNaira} onChange={(e) => setRate(e.target.value)} placeholder="15000" />
                </div>
                <div>
                  <label className="label">Years of experience</label>
                  <input className="input" type="number" min={0} value={yearsExperience} onChange={(e) => setYears(e.target.value)} placeholder="5" />
                </div>
              </div>

              <div className="border-t border-[color:var(--border)] pt-4">
                <p className="text-sm font-semibold">Payout details</p>
                <p className="text-xs text-[color:var(--muted)] mb-3">Where you&apos;d like earnings sent. Payouts are processed off-platform for now.</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <input className="input" value={payoutBankCode} onChange={(e) => setBank(e.target.value)} placeholder="Bank" />
                  <input className="input" value={payoutAccountNumber} onChange={(e) => setAcct(e.target.value)} placeholder="Account number" />
                  <input className="input" value={payoutAccountName} onChange={(e) => setAcctName(e.target.value)} placeholder="Account name" />
                </div>
              </div>

              <button className="btn btn-primary w-full" disabled={saving} onClick={submit}>
                {saving ? "Saving…" : profile ? "Save & resubmit for review" : "Submit application"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
