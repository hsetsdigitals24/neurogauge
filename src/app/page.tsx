"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";

const features = [
  { title: "Letters, Shapes & Rotated-E", desc: "Three stimulus modalities with a custom shape library and SVG-rendered rotations." },
  { title: "0-back to 3-back", desc: "Calibrated difficulty progression with priming trials and configurable target rates." },
  { title: "Auto or self-paced", desc: "Default 3 s per screen (0.5 s display + 2.5 s response). Fully adjustable." },
  { title: "NASA-TLX questionnaires", desc: "Per-level + global mental, physical, temporal demand, performance, effort, frustration & 9-point Paas effort." },
  { title: "Reaction-time precision", desc: "performance.now() RT capture, hits, misses, false alarms, d′, criterion." },
  { title: "Export to CSV / SPSS", desc: "Long-format trial data and wide-format summary. Open in Excel, R, or SPSS." },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="px-6 md:px-10 pb-20 max-w-6xl mx-auto w-full">
        <section className="pt-10 md:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-white border border-[color:var(--border)] pulse-dot">
             Neurogauge Research Platform
            </span>
            <h1 className="mt-5 text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              Measure working memory with{" "}
              <span className="gradient-text">research-grade precision.</span>
            </h1>
            <p className="mt-5 text-lg text-[color:var(--muted)] max-w-2xl">
              An N-back assessment platform for cognitive load, attention, and mental fatigue —
              ready for multi-participant studies, with structured exports for Excel and SPSS.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/test" className="btn btn-primary">Start a Session →</Link>
              <Link href="/admin" className="btn btn-ghost">Configure Study</Link>
            </div>
          </motion.div>
        </section>

        <section className="mt-16 grid md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="card p-6"
            >
              <div className="w-10 h-10 rounded-lg shimmer mb-4" />
              <h3 className="font-bold text-lg">{f.title}</h3>
              <p className="text-sm text-[color:var(--muted)] mt-1">{f.desc}</p>
            </motion.div>
          ))}
        </section>

        <section className="mt-20 card p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Ready to run your first session?</h2>
            <p className="text-[color:var(--muted)] mt-2 max-w-xl">
              Configure stimuli, levels, and timing in the admin panel, then share the participant link.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="btn btn-ghost">Admin</Link>
            <Link href="/test" className="btn btn-primary">Begin</Link>
          </div>
        </section>
      </main>
    </>
  );
}
