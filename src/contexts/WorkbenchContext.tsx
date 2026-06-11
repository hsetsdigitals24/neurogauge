"use client";
import React, { createContext, useContext } from "react";
import type { WorkbenchState, WorkbenchAction } from "@/lib/analytics/workbenchState";
import type { AnalysisSource } from "@/lib/analytics/client";

export interface WorkbenchContextValue {
  state: WorkbenchState;
  dispatch: React.Dispatch<WorkbenchAction>;
  filteredRows: Record<string, unknown>[];
  totalRows: number;
  /** Where analyses pull data from (project vs uploaded dataset). */
  source: AnalysisSource;
}

export const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

export function useWorkbench(): WorkbenchContextValue {
  const v = useContext(WorkbenchContext);
  if (!v) throw new Error("useWorkbench must be inside <WorkbenchContext.Provider>");
  return v;
}

export function useWorkbenchOptional(): WorkbenchContextValue | null {
  return useContext(WorkbenchContext);
}
