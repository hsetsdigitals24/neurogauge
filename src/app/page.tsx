"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Type, Layers, Clock, ClipboardList, Zap, Download, Users, Link2, BarChart3, LogIn } from "lucide-react";

const features = [
  { title: "Letters, Shapes & Rotated-E", desc: "Three stimulus modalities with a custom shape library and SVG-rendered rotations.", icon: Type },
  { title: "0-back to 3-back", desc: "Calibrated difficulty progression with priming trials and configurable target rates.", icon: Layers },
  { title: "Auto or self-paced", desc: "Default 3 s per screen (0.5 s display + 2.5 s response). Fully adjustable.", icon: Clock },
  { title: "NASA-TLX questionnaires", desc: "Per-level + global mental, physical, temporal demand, performance, effort, frustration & 9-point Paas effort.", icon: ClipboardList },
  { title: "Reaction-time precision", desc: "performance.now() RT capture, hits, misses, false alarms, d-prime, criterion.", icon: Zap },
  { title: "Export to CSV / SPSS", desc: "Long-format trial data and wide-format summary. Open in Excel, R, or SPSS.", icon: Download },
];

const newFeatures = [
  { title: "Multi-researcher accounts", desc: "Create a researcher account, build projects, and invite collaborators to view shared results.", icon: Users },
  { title: "Shareable test links", desc: "Each project gets a public link. No login required for test-takers.", icon: Link2 },
  { title: "Participant result lookup", desc: "Participants can retrieve their own results by email — privately and instantly.", icon: BarChart3 },
];

export default function Home() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setLoggedIn(!!d.user));
  }, []);

  return (
    <>
      <header className="w-full px-6 md:px-10 py-4 flex items-center justify-between border-b border-[color:var(--border)] bg-white/70 backdrop-blur sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl shimmer shadow" />
          <div>
            <div className="font-bold gradient-text">Neurogauge</div>
            <div className="text-xs text-[color:var(--muted)] hidden sm:block">Cognitive assessment platform</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/results" className="btn btn-ghost text-sm hidden sm:inline-flex">My results</Link>
          {loggedIn === null ? null : loggedIn ? (
            <Link href="/dashboard" className="btn btn-primary text-sm">Dashboard</Link>
          ) : (
            <>
              <Link href="/auth/login" className="btn btn-ghost text-sm flex items-center gap-1">
                <LogIn className="w-4 h-4" /> Sign in
              </Link>
              <Link href="/auth/signup" className="btn btn-primary text-sm">Sign up free</Link>
            </>
          )}
        </div>
      </header>

      <main className="px-6 md:px-10 pb-20 max-w-6xl mx-auto w-full">
        <section className="pt-10 md:pt-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-white border border-[color:var(--border)] pulse-dot">
              Neurogauge Research Platform
            </span>
            <h1 className="mt-5 text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              Measure working memory with{" "}
              <span className="gradient-text">research-grade precision.</span>
            </h1>
            <p className="mt-5 text-lg text-[color:var(--muted)] max-w-2xl">
              An N-back assessment platform for cognitive load, attention, and mental fatigue built for multi-participant studies. Create a project, share a link, collect results.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {loggedIn ? (
                <Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link>
              ) : (
                <Link href="/auth/signup" className="btn btn-primary">Start for free</Link>
              )}
              <Link href="/results" className="btn btn-ghost">Check my results</Link>
            </div>
          </motion.div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-extrabold mb-1">Designed for real research</h2>
          <p className="text-[color:var(--muted)] text-sm mb-6">Everything you need to run studies with multiple participants.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {newFeatures.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="card p-6 border-2 border-indigo-100">
                  <div className="w-10 h-10 rounded-lg shimmer flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-base">{f.title}</h3>
                  <p className="text-sm text-[color:var(--muted)] mt-1">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-extrabold mb-1">Platform capabilities</h2>
          <p className="text-[color:var(--muted)] text-sm mb-6">Built on solid cognitive science methodology.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.05 }} className="card p-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-lg">{f.title}</h3>
                  <p className="text-sm text-[color:var(--muted)] mt-1">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-2xl font-extrabold text-center mb-10">How it works</h2>
          <div className="grid md:grid-cols-4 gap-5 text-center">
            {[
              { step: "1", title: "Create account", desc: "Sign up as a researcher in seconds." },
              { step: "2", title: "Build a project", desc: "Configure stimuli, levels, timing, and questions." },
              { step: "3", title: "Share the link", desc: "Participants take the test, no login required." },
              { step: "4", title: "Analyse results", desc: "View all sessions from your dashboard." },
            ].map((s, i) => (
              <motion.div key={s.step} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="card p-6">
                <div className="w-10 h-10 rounded-full shimmer flex items-center justify-center text-white font-extrabold text-lg mx-auto mb-3">{s.step}</div>
                <h3 className="font-bold">{s.title}</h3>
                <p className="text-sm text-[color:var(--muted)] mt-1">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mt-20 card p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Ready to run your first study?</h2>
            <p className="text-[color:var(--muted)] mt-2 max-w-xl">
              Create an account, configure your N-back project, and share the link with participants.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            {loggedIn ? (
              <Link href="/dashboard" className="btn btn-primary">Open dashboard</Link>
            ) : (
              <>
                <Link href="/auth/login" className="btn btn-ghost">Sign in</Link>
                <Link href="/auth/signup" className="btn btn-primary">Get started</Link>
              </>
            )}
          </div>
        </section>

        <section className="mt-6 p-5 rounded-2xl border border-[color:var(--border)] bg-white/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Looking for your test results?</p>
            <p className="text-xs text-[color:var(--muted)]">Enter your email to retrieve all sessions associated with it.</p>
          </div>
          <Link href="/results" className="btn btn-ghost text-sm shrink-0">View my results</Link>
        </section>
      </main>
    </>
  );
}
