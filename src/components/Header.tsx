"use client";
import Link from "next/link";
import { motion } from "framer-motion";

export function Header() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full px-6 md:px-10 py-4 flex items-center justify-between"
    >
      <Link href="/" className="flex items-center gap-3 group">
        <div className="w-10 h-10 rounded-xl shimmer shadow-lg" />
        <div>
          <div className="font-bold text-lg leading-tight gradient-text">Neurogauge</div>
          <div className="text-xs text-[color:var(--muted)]">Cognitive assessment platform</div>
        </div>
      </Link>
      <nav className="flex items-center gap-2">
        <Link href="/admin" className="btn btn-ghost text-sm">Admin</Link>
        <Link href="/test" className="btn btn-primary text-sm">Start Session</Link>
      </nav>
    </motion.header>
  );
}
