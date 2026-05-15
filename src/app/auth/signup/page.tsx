"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Signup failed"); return; }
      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl shimmer shadow-lg" />
          <div>
            <div className="font-bold text-xl gradient-text">Neurogauge</div>
            <div className="text-xs text-[color:var(--muted)]">Neuroscience Lab</div>
          </div>
        </Link>
        <div className="card p-8">
          <h1 className="text-2xl font-extrabold mb-1">Create an account</h1>
          <p className="text-sm text-[color:var(--muted)] mb-6">
            For researchers who want to run and manage N-back studies.
          </p>
          <form onSubmit={submit} className="space-y-4">
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
              <input className="input" type="password" required autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
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
        </div>
      </motion.div>
    </main>
  );
}
