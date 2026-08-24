"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, ChevronRight, Upload, Grid3x3, Sparkles,
} from "lucide-react";

// Each project-creation entry point.
interface Choice {
  key: string;
  title: string;
  desc: string;
  icon: typeof Upload;
  href: string;
  cta: string;
}

const CHOICES: Choice[] = [
  {
    key: "dataset",
    title: "Upload dataset",
    desc: "Bring your own CSV or Excel file and analyse it in the workbench — columns and types are fully editable.",
    icon: Upload,
    href: "/dashboard/datasets",
    cta: "Upload data",
  },
  {
    key: "nback",
    title: "N-back project",
    desc: "Configure a working-memory N-back study — stimulus types, levels, timing, and custom questions — and collect data online.",
    icon: Grid3x3,
    href: "/dashboard/projects/new?type=nback",
    cta: "Configure study",
  },
  {
    key: "ai-questionnaire",
    title: "AI questionnaire",
    desc: "Describe your construct and let AI draft a questionnaire you can review, edit, and publish for online collection.",
    icon: Sparkles,
    href: "/dashboard/projects/new?type=ai-questionnaire",
    cta: "Set up generation",
  },
];

export default function ProjectTypeChooser() {
  const backHref = "/dashboard";

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-5xl mx-auto w-full">
        <div className="mt-6">
          <Link href={backHref} className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <h1 className="text-3xl md:text-4xl font-extrabold">
            Create <span className="gradient-text">something new</span>
          </h1>
          <p className="text-[color:var(--muted)] mt-1 text-sm">
            Choose what you want to build.
          </p>
        </motion.div>

        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {CHOICES.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={c.href}
                  className="card p-6 h-full flex flex-col hover:shadow-lg hover:border-[color:var(--primary)] transition group"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h2 className="font-bold text-lg mt-4">{c.title}</h2>
                  <p className="text-sm text-[color:var(--muted)] mt-1 flex-1">{c.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--primary)]">
                    {c.cta}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
