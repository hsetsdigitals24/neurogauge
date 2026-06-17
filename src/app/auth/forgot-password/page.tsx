"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { notify } from "@/lib/toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error(data.error ?? "Request failed");
        return;
      }
      setSent(true);
    } catch {
      notify.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-3 mb-8 group justify-center">
          
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
          <h1 className="text-2xl font-extrabold mb-1">Forgot your password?</h1>
          <p className="text-sm text-[color:var(--muted)] mb-6">
            Enter your email and we&apos;ll send you a link to reset it.
          </p>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm">
                If an account exists for <span className="font-semibold">{email}</span>, a password
                reset link has been sent. The link will expire in 1 hour.
              </p>
              <Link href="/auth/login" className="btn btn-primary w-full inline-flex justify-center">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <p className="text-sm text-center text-[color:var(--muted)]">
                Remembered it?{" "}
                <Link
                  href="/auth/login"
                  className="text-[color:var(--primary)] font-semibold hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </main>
  );
}
