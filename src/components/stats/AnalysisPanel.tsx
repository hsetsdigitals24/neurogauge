"use client";
import { CustomQuestion } from "@/lib/types";
import { WorkspaceProvider } from "./workspace/WorkspaceProvider";
import { AnalysisWorkspace } from "./workspace/AnalysisWorkspace";
import { FlaskConical } from "lucide-react";

interface AnalysisPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[];
  questions: CustomQuestion[];
  projectId?: string;
}

export function AnalysisPanel({ sessions, questions, projectId }: AnalysisPanelProps) {
  if (sessions.length === 0) {
    return (
      <div className="card p-10 text-center">
        <FlaskConical className="w-10 h-10 mx-auto text-[color:var(--muted)] mb-3" />
        <p className="text-[color:var(--muted)]">No sessions yet — analyses become available once you have data.</p>
      </div>
    );
  }
  return (
    <WorkspaceProvider projectId={projectId ?? "default"} sessions={sessions} questions={questions}>
      <AnalysisWorkspace />
    </WorkspaceProvider>
  );
}

export default AnalysisPanel;
