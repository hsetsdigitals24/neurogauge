"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Reads the caller's AI-analysis credit balance from the billing products
 * endpoint. Returns the balance (null while loading) and a `refresh` to re-read
 * it after a credit is spent (e.g. right after an AI Statistician run).
 */
export function useAiCredits() {
  const [credits, setCredits] = useState<number | null>(null);

  const refresh = useCallback(() => {
    return fetch("/api/billing/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.aiCredits === "number") setCredits(d.aiCredits); })
      .catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { credits, refresh };
}
