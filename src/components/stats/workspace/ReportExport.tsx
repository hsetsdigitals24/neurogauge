"use client";
import { useWorkspace } from "./WorkspaceProvider";
import { transformLabel } from "@/lib/stats";

const REPORT_KEY = "workspace-report-handoff";

/**
 * Bundle the workspace state into a printable HTML report and open it in a new tab.
 * The new tab reads the handoff via localStorage and renders the report.
 */
export function useReportExport() {
  const ws = useWorkspace();
  return () => {
    const payload = {
      projectId: ws.state.projectId,
      variables: ws.state.variables.map((v) => ({
        id: v.id, label: v.label, role: v.role,
        source: v.source.kind === "derived"
          ? { kind: "derived", transform: transformLabel(v.source.transform, (id) => ws.labelOf(id)) }
          : { kind: "native" },
      })),
      filter: ws.state.filter.clauses.map((c) => ({ label: ws.labelOf(c.variableId), op: c.op, value: c.value })),
      outputs: [...ws.state.outputs].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.timestamp - a.timestamp;
      }),
      generatedAt: new Date().toISOString(),
    };
    localStorage.setItem(REPORT_KEY, JSON.stringify(payload));
    window.open(`/dashboard/projects/${ws.state.projectId}/report`, "_blank");
  };
}

export const REPORT_HANDOFF_KEY = REPORT_KEY;
