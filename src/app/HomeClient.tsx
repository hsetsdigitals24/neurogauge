"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Brain,
  BarChart3,
  Users,
  GraduationCap,
  Type,
  Layers,
  Clock,
  ClipboardList,
  Zap,
  Download,
  Link2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

// The four pillars of the end-to-end research lifecycle — each paired with a
// generated brand image in /public/assets/landing.
const pillars = [
  {
    title: "Cognitive assessment",
    desc: "Run N-back working-memory studies across Letters, Shapes & Rotated-E with NASA-TLX load questionnaires and AI-drafted surveys.",
    icon: Brain,
    img: "/assets/landing/assessment.png",
    href: "/dashboard/projects/new",
  },
  {
    title: "Statistical analytics",
    desc: "An SPSS-style workbench — descriptives, t-tests, ANOVA, regression, reliability, SEM — with an AI statistician to guide every test.",
    icon: BarChart3,
    img: "/assets/landing/analytics.png",
    href: "/dashboard",
  },
  {
    title: "Expert consulting",
    desc: "Book approved statistical consultants for study design and analysis. Message, meet and review — all in one place.",
    icon: Users,
    img: "/assets/landing/collaboration.png",
    href: "/dashboard/consulting",
  },
  {
    title: "Training & certification",
    desc: "Learn research methods through structured courses and earn verifiable certificates to prove your competency.",
    icon: GraduationCap,
    img: "/assets/landing/training.png",
    href: "/dashboard/training",
  },
];

const capabilities = [
  { title: "Letters, Shapes & Rotated-E", desc: "Three stimulus modalities with a custom shape library and SVG-rendered rotations.", icon: Type },
  { title: "0-back to 3-back", desc: "Calibrated difficulty with priming trials and configurable target rates.", icon: Layers },
  { title: "Auto or self-paced", desc: "Default 3 s per screen (0.5 s display + 2.5 s response). Fully adjustable.", icon: Clock },
  { title: "NASA-TLX questionnaires", desc: "Per-level + global mental, physical, temporal demand, performance, effort & frustration.", icon: ClipboardList },
  { title: "Reaction-time precision", desc: "performance.now() RT capture, hits, misses, false alarms, d-prime, criterion.", icon: Zap },
  { title: "Export to CSV / SPSS", desc: "Long-format trial data and wide-format summary. Open in Excel, R, or SPSS.", icon: Download },
];

const stats = [
  { value: "3", label: "Stimulus modalities" },
  { value: "15+", label: "Statistical analyses" },
  { value: "0-3", label: "N-back difficulty levels" },
  { value: "100%", label: "Browser-based, no install" },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

export default function Home() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setLoggedIn(!!d.user)).catch(() => setLoggedIn(false));
  }, []);

  return (
    <main className="w-full">
      {/* ---------------------------------------------------------------- */}
      {/* HERO */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/* soft aurora glows */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="pointer-events-none absolute top-20 -right-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="max-w-6xl mx-auto px-6 md:px-10 pt-14 md:pt-24 pb-10 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-[color:var(--border)] pulse-dot">
              End-to-end research platform
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              One platform for the entire{" "}
              <span className="gradient-text">research</span> lifecycle.
            </h1>
            <p className="mt-6 text-lg text-[color:var(--muted)] max-w-xl">
              From cognitive assessment to statistical analytics, expert consulting and
              certified training — Neurogauge gives researchers everything needed to
              design studies, collect data and publish with confidence.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {loggedIn ? (
                <Link href="/dashboard" className="btn btn-primary group">
                  Go to dashboard
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <Link href="/auth/signup" className="btn btn-primary group">
                  Start for free
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              <Link href="/results" className="btn btn-ghost">Check my results</Link>
            </div>
            <div className="mt-8 flex items-center gap-5 text-xs text-[color:var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[color:var(--success)]" /> Research-grade methodology</span>
              <span className="inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-[color:var(--primary)]" /> AI-assisted analysis</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative rounded-[1.75rem] overflow-hidden border border-white/60 shadow-[0_30px_80px_-30px_rgba(15,23,42,.45)]">
              <Image
                src="/assets/landing/hero.png"
                alt="Abstract brain morphing into statistical data visualizations"
                width={1536}
                height={1024}
                priority
                className="w-full h-auto"
              />
            </div>
            {/* floating glass stat card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="absolute -bottom-5 -left-4 sm:left-6 card px-4 py-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg shimmer flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold leading-tight">d-prime · 2.14</div>
                <div className="text-[11px] text-[color:var(--muted)] leading-tight">Live analytics workbench</div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* stat strip */}
        <div className="max-w-6xl mx-auto px-6 md:px-10 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                {...fadeUp}
                transition={{ delay: i * 0.06 }}
                className="card px-5 py-4 text-center"
              >
                <div className="text-2xl md:text-3xl font-extrabold gradient-text">{s.value}</div>
                <div className="text-xs text-[color:var(--muted)] mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* PILLARS */}
      {/* ---------------------------------------------------------------- */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 mt-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Built for real <span className="gradient-text">research</span>
          </h2>
          <p className="text-[color:var(--muted)] mt-3">
            Four connected workspaces cover the full arc of a study — no more stitching
            together spreadsheets, survey tools and stats software.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-7 md:gap-10 max-w-5xl mx-auto">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            const reversed = i % 2 === 1;
            return (
              <motion.div key={p.title} {...fadeUp} transition={{ delay: i * 0.08 }}>
                <Link
                  href={p.href}
                  className={`group overflow-hidden grid md:grid-cols-2 items-stretch hover:-translate-y-1 transition-transform duration-300 ${reversed ? "md:[&>*:first-child]:order-2" : ""}`}
                >
                  <div className="relative h-38 md:h-auto md:min-h-[13.5rem] overflow-hidden">
                    <Image
                      src={p.img}
                      alt={p.title}
                      width={1024}
                      height={1024}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary-2/40 to-transparent" />
                  </div>
                  <div className="p-6 md:p-8 flex flex-col justify-center">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[color:var(--primary)]/10 text-[color:var(--primary)] flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-lg">{p.title}</span>
                    </div>
                    <p className="text-sm text-[color:var(--muted)] mt-3.5 leading-relaxed">{p.desc}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--primary)] group-hover:gap-2.5 transition-all">
                      Explore <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* CAPABILITIES */}
      {/* ---------------------------------------------------------------- */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 mt-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Platform capabilities</h2>
          <p className="text-[color:var(--muted)] mt-3">Built on solid cognitive-science methodology, precise to the millisecond.</p>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.title} {...fadeUp} transition={{ delay: i * 0.05 }} className="card p-6 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-lg">{f.title}</h3>
                <p className="text-sm text-[color:var(--muted)] mt-1">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* HOW IT WORKS */}
      {/* ---------------------------------------------------------------- */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 mt-24">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-center">How it works</h2>
        <p className="text-[color:var(--muted)] mt-3 text-center max-w-xl mx-auto">Go from idea to analysed data in four steps.</p>
        <div className="mt-12 grid md:grid-cols-4 gap-5">
          {[
            { step: "1", title: "Create account", desc: "Sign up as a researcher in seconds.", icon: Users },
            { step: "2", title: "Build a project", desc: "Configure stimuli, levels, timing and questions.", icon: Layers },
            { step: "3", title: "Share the link", desc: "Participants take the test — no login required.", icon: Link2 },
            { step: "4", title: "Analyse results", desc: "Run the stats workbench from your dashboard.", icon: BarChart3 },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.step} {...fadeUp} transition={{ delay: i * 0.07 }} className="relative card p-6">
                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white border border-[color:var(--border)] flex items-center justify-center text-xs font-extrabold text-[color:var(--primary)] shadow">
                  {s.step}
                </div>
                <div className="w-11 h-11 rounded-xl shimmer flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold">{s.title}</h3>
                <p className="text-sm text-[color:var(--muted)] mt-1">{s.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* CTA */}
      {/* ---------------------------------------------------------------- */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 mt-24 mb-20">
        <motion.div
          {...fadeUp}
          className="relative overflow-hidden rounded-[1.75rem] p-8 md:p-12 text-white"
          style={{ background: "linear-gradient(135deg, #4f46e5, #06b6d4 70%, #f59e0b)" }}
        >
          <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold">Ready to run your first study?</h2>
              <p className="mt-2 max-w-xl text-white/85">
                Create an account, configure your project and share the link with
                participants. Your first project is on us.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              {loggedIn ? (
                <Link href="/dashboard" className="btn bg-white text-indigo-700 hover:bg-white/90">Open dashboard</Link>
              ) : (
                <>
                  <Link href="/auth/login" className="btn bg-white/15 text-white border border-white/30 hover:bg-white/25">Sign in</Link>
                  <Link href="/auth/signup" className="btn bg-white text-indigo-700 hover:bg-white/90">Get started</Link>
                </>
              )}
            </div>
          </div>
        </motion.div>

        <div className="mt-6 p-5 rounded-2xl border border-[color:var(--border)] bg-white/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Looking for your test results?</p>
            <p className="text-xs text-[color:var(--muted)]">Enter your email to retrieve all sessions associated with it.</p>
          </div>
          <Link href="/results" className="btn btn-ghost text-sm shrink-0">View my results</Link>
        </div>
      </section>
    </main>
  );
}
