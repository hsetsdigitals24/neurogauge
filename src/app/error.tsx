"use client";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
