"use client";
import { useState } from "react";
import { runAnalysis, type AnalysisResponse } from "./client";

export interface BackendRunState {
  loading: boolean;
  error: string | null;
  result: AnalysisResponse | null;
}

export function useBackendRun() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  async function run(
    analysisKey: string,
    payload: Parameters<typeof runAnalysis>[1]
  ) {
    setLoading(true);
    setError(null);
    try {
      setResult(await runAnalysis(analysisKey, payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setResult(null);
    setError(null);
  }

  return { run, loading, error, result, clear };
}
