"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import PasswordInput from "@/components/PasswordInput";
import { notify } from "@/lib/toast";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { notify.error(data.error ?? "Login failed"); return; }
      notify.success("Signed in");
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
        <label className="label">Email</label>
        <input className="input" type="email" autoComplete="email" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label">Password</label>
          <Link href="/auth/forgot-password" className="text-xs text-[color:var(--primary)] font-semibold hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      <button className="btn btn-primary w-full" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-center text-[color:var(--muted)]">
        No account?{" "}
        <Link href="/auth/signup" className="text-[color:var(--primary)] font-semibold hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-extrabold mb-1">Welcome back</h1>
          <p className="text-sm text-[color:var(--muted)] mb-6">Sign in to your researcher account.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </motion.div>
    </main>
  );
}
