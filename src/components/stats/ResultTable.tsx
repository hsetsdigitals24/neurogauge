"use client";
import { Download } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/stats";

export interface ResultRow { label: string; value: string | number; }

export function StatTable({ rows, title }: { rows: ResultRow[]; title?: string }) {
  return (
    <div className="mt-2">
      {title && <h4 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-2">{title}</h4>}
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[color:var(--border)]">
              <td className="py-1.5 pr-4 text-[color:var(--muted)]">{r.label}</td>
              <td className="py-1.5 font-mono text-right">{typeof r.value === "number" ? r.value : r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CsvDownload({ filename, rows }: { filename: string; rows: (string | number | null | undefined)[][] }) {
  return (
    <button
      onClick={() => downloadCsv(filename, toCsv(rows))}
      className="btn btn-ghost text-xs flex items-center gap-1"
    >
      <Download className="w-3.5 h-3.5" /> Download CSV
    </button>
  );
}
