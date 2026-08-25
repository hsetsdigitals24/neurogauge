"use client";
import { useEffect } from "react";

// A "Failed to load chunk" / ChunkLoadError almost always means the browser is
// holding a previous deploy's HTML that points at chunk filenames the new deploy
// no longer serves. Reloading fetches the fresh HTML + chunk names and recovers.
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to load chunk|error loading dynamically imported module|Importing a module script failed/i;

// Guard against reload loops: if reloading doesn't fix it (a chunk is genuinely
// gone), don't keep reloading — fall back to the manual UI after one attempt.
const RELOAD_KEY = "ng_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 10_000;

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.name === "ChunkLoadError" || CHUNK_ERROR_RE.test(error?.message ?? "");

  useEffect(() => {
    console.error(error);
    if (!isChunkError || typeof window === "undefined") return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
      if (Date.now() - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // sessionStorage unavailable (private mode) — reload once anyway.
      window.location.reload();
    }
  }, [error, isChunkError]);

  if (isChunkError) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
        <h2 className="text-xl font-bold">Updating to the latest version…</h2>
        <p className="text-[color:var(--muted)] text-sm max-w-md">
          A new version was just deployed. Reloading to pick it up.
        </p>
        <button onClick={() => window.location.reload()} className="btn btn-primary">
          Reload now
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="text-[color:var(--muted)] text-sm max-w-md">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      {error.digest && (
        <p className="text-xs text-[color:var(--muted)] font-mono">Error ID: {error.digest}</p>
      )}
      <button onClick={reset} className="btn btn-primary">
        Try again
      </button>
    </main>
  );
}
