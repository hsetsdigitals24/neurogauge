"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Header } from "@/components/Header";
import { notify } from "@/lib/toast";

interface Row {
  id: string; participantId: string;
  startedAt: string; finishedAt: string | null;
  consentGiven: boolean; createdAt: string;
  _count: { blocks: number };
}

export default function SessionsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setRows)
      .catch((e) => { setError(String(e)); notify.error("Failed to load sessions"); });
  }, []);

  return (
    <>
      <Header />
      <main className="px-6 md:px-10 pb-20 max-w-6xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-3 flex-wrap mt-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Saved <span className="gradient-text">sessions</span></h1>
            <p className="text-[color:var(--muted)] mt-1 text-sm">Most recent 200, newest first.</p>
          </div>
          <div className="flex gap-2">
            <a className="btn btn-ghost" href="/api/export?format=long">Export trials (long)</a>
            <a className="btn btn-primary" href="/api/export?format=wide">Export summary (wide)</a>
          </div>
        </motion.div>

        <div className="card p-6 mt-6 overflow-x-auto">
          {error && <p className="text-sm text-[color:var(--danger)]">Failed to load: {error}. Is the database running?</p>}
          {!rows && !error && <p className="text-sm text-[color:var(--muted)]">Loading…</p>}
          {rows && rows.length === 0 && <p className="text-sm text-[color:var(--muted)]">No sessions yet. Run one from the <Link className="underline" href="/test">test page</Link>.</p>}
          {rows && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr>
                  <th className="py-2">Participant</th><th>Started</th><th>Finished</th>
                  <th>Blocks</th><th>Consent</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[color:var(--border)]">
                    <td className="py-2 font-mono">{r.participantId}</td>
                    <td>{new Date(r.startedAt).toLocaleString()}</td>
                    <td>{r.finishedAt ? new Date(r.finishedAt).toLocaleString() : "—"}</td>
                    <td>{r._count.blocks}</td>
                    <td>{r.consentGiven ? "✓" : "—"}</td>
                    <td className="text-right">
                      <span className="kbd text-[10px]">{r.id.slice(-6)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
