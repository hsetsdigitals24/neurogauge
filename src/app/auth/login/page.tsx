"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Login failed"); return; }
      router.push(next);
    } catch {
      setError("Network error");
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
        <input className="input" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
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
        <Link href="/" className="flex items-center gap-3 mb-8 group justify-center">
          <div className="w-10 h-10 rounded-xl shimmer shadow-lg" />
          <div className="min-w-0">
                    
                     <div className="font-bold text-base sm:text-lg md:text-xl leading-tight gradient-text truncate"> 
                      <Image src="/assets/Asset 4@4x.png" alt="Logo" width={100} height={30} className="h-auto w-auto" />
                     </div> 
                       <div className="text-xs leading-tight text-[color:var(--muted)] hidden sm:block truncate">
                         Neuroscience Lab
                       </div>
                    
                   </div>
        </Link>
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
