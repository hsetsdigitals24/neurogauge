"use client";
import { useEffect, useState } from "react";
import { REPORT_HANDOFF_KEY } from "@/components/stats/workspace/ReportExport";

interface ReportPayload {
  projectId: string;
  variables: { id: string; label: string; role: string; source: { kind: string; transform?: string } }[];
  filter: { label: string; op: string; value: string | number | string[] }[];
  outputs: { id: string; timestamp: number; title: string; htmlSnapshot: string; pinned: boolean }[];
  generatedAt: string;
}

export default function ReportPage() {
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REPORT_HANDOFF_KEY);
      if (raw) setPayload(JSON.parse(raw));
    } catch { /* */ }
  }, []);

  if (!payload) {
    return <div className="p-10 text-center text-gray-500">No report data — open this page from the workspace's <em>Report</em> button.</div>;
  }
  const date = new Date(payload.generatedAt).toLocaleString();

  return (
    <div className="report mx-auto px-8 py-10 max-w-4xl text-gray-900">
      <style>{`
        @media print { .no-print { display: none !important; } body { background: white; } }
        .report h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
        .report h2 { font-size: 16px; font-weight: 700; margin-top: 28px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .report h3 { font-size: 13px; font-weight: 700; margin-top: 16px; margin-bottom: 4px; }
        .report table { border-collapse: collapse; margin: 8px 0; }
        .report table th, .report table td { border-bottom: 1px solid #e5e7eb; padding: 4px 8px; text-align: left; font-size: 12px; }
        .report .snapshot { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin: 8px 0; }
        .report .snapshot svg { max-width: 100%; height: auto; }
      `}</style>
      <div className="no-print mb-6 flex justify-end gap-2">
        <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </div>
      <h1>Analysis Report</h1>
      <p className="text-sm text-gray-600">Generated {date} · Project {payload.projectId}</p>

      <h2>Variables ({payload.variables.length})</h2>
      <table>
        <thead><tr><th>Label</th><th>Role</th><th>Source / transform</th></tr></thead>
        <tbody>
          {payload.variables.map((v) => (
            <tr key={v.id}>
              <td>{v.label}</td>
              <td>{v.role}</td>
              <td>{v.source.transform ?? v.source.kind}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Filter</h2>
      {payload.filter.length === 0
        ? <p className="text-sm text-gray-600">No filter applied — all participants included.</p>
        : <ul className="text-sm">
            {payload.filter.map((c, i) => <li key={i}><code>{c.label} {c.op} {String(c.value)}</code></li>)}
          </ul>
      }

      <h2>Analyses ({payload.outputs.length})</h2>
      {payload.outputs.length === 0 && <p className="text-sm text-gray-600">No saved analyses.</p>}
      {payload.outputs.map((o) => (
        <div key={o.id} className="snapshot">
          <h3>{o.title} {o.pinned && <span className="text-indigo-600">· pinned</span>}</h3>
          <div className="text-xs text-gray-500 mb-2">{new Date(o.timestamp).toLocaleString()}</div>
          <div dangerouslySetInnerHTML={{ __html: o.htmlSnapshot }} />
        </div>
      ))}
    </div>
  );
}
