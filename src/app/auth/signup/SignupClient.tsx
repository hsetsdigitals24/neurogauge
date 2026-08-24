"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { GraduationCap, Building2, FlaskRound } from "lucide-react";
import PasswordInput from "@/components/PasswordInput";
import { notify } from "@/lib/toast";

type AccountType = "student" | "institution" | "research_group";

const ACCOUNT_OPTIONS: { value: AccountType; label: string; desc: string; icon: typeof GraduationCap }[] = [
  { value: "student", label: "Student", desc: "Run your own studies", icon: GraduationCap },
  { value: "institution", label: "Institution", desc: "Multicenter teams & sites", icon: Building2 },
  { value: "research_group", label: "Research group", desc: "Collaborate with your lab", icon: FlaskRound },
];

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { notify.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, accountType }),
      });
      const data = await res.json();
      if (!res.ok) { notify.error(data.error ?? "Signup failed"); return; }
      notify.success("Account created");
      router.push(next);
    } catch {
      notify.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Account type</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {ACCOUNT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = accountType === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setAccountType(opt.value)}
                className={`flex flex-col items-center text-center gap-1 px-2 py-3 rounded-xl border transition-colors ${
                  active
                    ? "border-[color:var(--primary)] bg-indigo-50 text-indigo-700"
                    : "border-[color:var(--border)] hover:border-[color:var(--primary)]"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                <span className="text-[10px] text-[color:var(--muted)] leading-tight">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="label">Full name</label>
        <input className="input" required autoComplete="name"
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label">Password <span className="font-normal text-[color:var(--muted)]">(min 8 characters)</span></label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </div>
      <button className="btn btn-primary w-full" type="submit" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </button>
      <p className="text-sm text-center text-[color:var(--muted)]">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-[color:var(--primary)] font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-extrabold mb-1">Create an account</h1>
          <p className="text-sm text-[color:var(--muted)] mb-6">
            For researchers who want to run and manage N-back studies.
          </p>
          <Suspense>
            <SignupForm />
          </Suspense>
        </div>
      </motion.div>
    </main>
  );
}
