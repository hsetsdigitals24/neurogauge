"use client";
import { useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * App-wide confirmation dialog — a styled replacement for the native, blocking
 * window.confirm(). Call `confirmDialog(...)` from anywhere; it returns a Promise
 * that resolves true (confirmed) or false (cancelled/dismissed). The <ConfirmHost/>
 * that renders the popup is mounted once in the root layout, next to <AppToaster/>.
 *
 *   if (!(await confirmDialog("Delete this?"))) return;
 */
export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & { id: number; resolve: (v: boolean) => void };

// Simple module-level pub/sub (same shape as sonner's imperative API) so any
// client component can trigger the single host without prop-drilling a provider.
let listeners: ((c: PendingConfirm) => void)[] = [];
let counter = 0;

export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === "string" ? { message: options } : options;
  return new Promise<boolean>((resolve) => {
    const pending: PendingConfirm = { ...opts, id: ++counter, resolve };
    if (listeners.length === 0) {
      // No host mounted (shouldn't happen in-app) — fail safe by cancelling.
      resolve(false);
      return;
    }
    listeners.forEach((l) => l(pending));
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    const listener = (c: PendingConfirm) => setPending(c);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const close = useCallback(
    (result: boolean) => {
      setPending((p) => {
        p?.resolve(result);
        return null;
      });
    },
    []
  );

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  if (!pending) return null;

  const danger = pending.danger ?? true; // most confirms guard destructive actions

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close(false);
      }}
    >
      <div className="card w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-start gap-3">
          {danger && (
            <span className="shrink-0 mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--danger)]/10">
              <AlertTriangle className="w-5 h-5 text-[color:var(--danger)]" />
            </span>
          )}
          <div className="min-w-0">
            {pending.title && <h3 className="font-bold text-base mb-1">{pending.title}</h3>}
            <p className="text-sm text-[color:var(--muted)] whitespace-pre-line">{pending.message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-ghost border border-[color:var(--border)]" onClick={() => close(false)}>
            {pending.cancelLabel ?? "Cancel"}
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            autoFocus
            onClick={() => close(true)}
          >
            {pending.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
