"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Reads the caller's project-credit balance from the billing products endpoint.
 * Every new project consumes one credit, so creation flows use this to warn
 * up-front and to re-check after a purchase. Returns the balance (null while
 * loading) and a `refresh` to re-read it.
 */
export function useProjectCredits() {
  const [credits, setCredits] = useState<number | null>(null);

  const refresh = useCallback(() => {
    return fetch("/api/billing/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.projectCredits === "number") setCredits(d.projectCredits); })
      .catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { credits, refresh };
}
