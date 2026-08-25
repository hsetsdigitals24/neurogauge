"use client";
import { useEffect } from "react";

// Global safety net for stale-deploy chunk failures that surface as uncaught
// window errors / rejected dynamic imports (e.g. during a client-side route
// transition) and therefore never reach a React error boundary. When we see
// one, reload once to pick up the freshly deployed HTML + chunk names.
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to load chunk|error loading dynamically imported module|Importing a module script failed/i;

const RELOAD_KEY = "ng_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 10_000;

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
    if (Date.now() - last <= RELOAD_COOLDOWN_MS) return; // guard against loops
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // ignore storage failures and reload anyway
  }
  window.location.reload();
}

export function ChunkGuard() {
  useEffect(() => {
    function onError(e: ErrorEvent) {
      const msg = e?.message || (e?.error instanceof Error ? e.error.message : "");
      if (CHUNK_ERROR_RE.test(String(msg))) reloadOnce();
    }
    function onRejection(e: PromiseRejectionEvent) {
      const reason = e?.reason;
      const msg = reason instanceof Error ? reason.message : String(reason ?? "");
      const name = reason instanceof Error ? reason.name : "";
      if (name === "ChunkLoadError" || CHUNK_ERROR_RE.test(msg)) reloadOnce();
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
