"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import PasswordInput from "@/components/PasswordInput";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Missing reset token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          Your password has been reset. Redirecting you to sign in…
        </p>
        <Link href="/auth/login" className="btn btn-primary w-full inline-flex justify-center">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">
          New password{" "}
          <span className="font-normal text-[color:var(--muted)]">(min 8 characters)</span>
        </label>
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <PasswordInput
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
      <button className="btn btn-primary w-full" type="submit" disabled={loading}>
        {loading ? "Resetting…" : "Reset password"}
      </button>
      <p className="text-sm text-center text-[color:var(--muted)]">
        <Link
          href="/auth/login"
          className="text-[color:var(--primary)] font-semibold hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
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
          <h1 className="text-2xl font-extrabold mb-1">Choose a new password</h1>
          <p className="text-sm text-[color:var(--muted)] mb-6">
            Set a new password for your researcher account.
          </p>
          <Suspense>
            <ResetForm />
          </Suspense>
        </div>
      </motion.div>
    </main>
  );
}
