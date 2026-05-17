"use client";
import { useMemo, useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { fmt, toCsv, downloadCsv } from "@/lib/stats";
import { Download } from "lucide-react";

export function DataView() {
  const ws = useWorkspace();
  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(null);

  const allPids = useMemo(() => {
    const set = new Set<string>();
    for (const s of ws.sessions) set.add(s.participantId ?? s.takerEmail ?? s.id);
    return [...set];
  }, [ws.sessions]);

  const pids = useMemo(() => {
    if (!ws.visibleParticipants) return allPids;
    return allPids.filter((p) => ws.visibleParticipants!.has(p));
  }, [allPids, ws.visibleParticipants]);

  const variables = visibleIds ? ws.variables.filter((v) => visibleIds.has(v.id)) : ws.variables.slice(0, 12);

  // Resolve all needed maps once
  const valueMaps = useMemo(() => {
    const out = new Map<string, Map<string, number | string | null>>();
    for (const v of variables) out.set(v.id, ws.resolveAny(v.id));
    return out;
  }, [variables, ws]);

  function exportCsv() {
    const head = ["participant_id", ...variables.map((v) => v.label)];
    const rows = pids.map((pid) => [pid, ...variables.map((v) => {
      const val = valueMaps.get(v.id)?.get(pid);
      return val == null ? "" : val;
    })]);
    downloadCsv("data_view.csv", toCsv([head, ...rows]));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--border)]">
        <span className="text-xs text-[color:var(--muted)]">
          {pids.length} rows × {variables.length} variables
          {ws.variables.length > variables.length && <> · <button className="underline" onClick={() => setVisibleIds(new Set(ws.variables.map((v) => v.id)))}>show all {ws.variables.length}</button></>}
        </span>
        <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5" /> Export visible
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="text-xs">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-[color:var(--border)]">
              <th className="px-2 py-1.5 text-left text-[color:var(--muted)] sticky left-0 bg-white">pid</th>
              {variables.map((v) => (
                <th key={v.id} className="px-2 py-1.5 text-left text-[color:var(--muted)] font-semibold whitespace-nowrap">
                  {v.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pids.map((pid) => (
              <tr key={pid} className="border-b border-[color:var(--border)] hover:bg-gray-50">
                <td className="px-2 py-1 font-mono sticky left-0 bg-white text-[color:var(--muted)]">{truncate(pid, 12)}</td>
                {variables.map((v) => {
                  const val = valueMaps.get(v.id)?.get(pid);
                  return (
                    <td key={v.id} className="px-2 py-1 font-mono whitespace-nowrap">
                      {val == null ? "—" : typeof val === "number" ? fmt(val) : truncate(String(val), 18)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
