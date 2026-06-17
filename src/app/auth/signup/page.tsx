"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import PasswordInput from "@/components/PasswordInput";
import { notify } from "@/lib/toast";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { notify.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
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
        <Link href="/" className="flex items-center gap-3 mb-8 justify-center">
          {/* <div className="w-10 h-10 rounded-xl shimmer shadow-lg" /> */}
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
