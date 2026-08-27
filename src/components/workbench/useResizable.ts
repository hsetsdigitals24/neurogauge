"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface ResizableOptions {
  /** localStorage key so the chosen size persists across reloads. */
  storageKey: string;
  /** Starting size in px (used before any stored value / drag). */
  initial: number;
  /** Clamp bounds in px. */
  min: number;
  max: number;
  /** "x" = width (horizontal drag), "y" = height (vertical drag). */
  axis: "x" | "y";
  /**
   * When the drag handle sits on the leading edge of the panel (left panel's
   * right edge grows with the pointer → false; bottom panel's top edge grows
   * as the pointer moves UP → true), invert the pointer delta.
   */
  invert?: boolean;
}

/**
 * Generic drag-to-resize for a workbench panel. Returns the current size, a
 * pointer-down handler to attach to a drag handle, and a `dragging` flag for
 * styling. Size is clamped to [min, max] and persisted to localStorage.
 */
export function useResizable({ storageKey, initial, min, max, axis, invert }: ResizableOptions) {
  const [size, setSize] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ pos: 0, size: 0 });

  // Hydrate the stored size on mount (client-only, avoids SSR mismatch).
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      const n = Number(saved);
      // Deferred read (not a lazy initializer) keeps SSR/first render stable and
      // avoids hydration mismatch; the one-time catch-up render is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Number.isFinite(n)) setSize(Math.min(max, Math.max(min, n)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      start.current = { pos: axis === "x" ? e.clientX : e.clientY, size };
      setDragging(true);

      function move(ev: PointerEvent) {
        const cur = axis === "x" ? ev.clientX : ev.clientY;
        let delta = cur - start.current.pos;
        if (invert) delta = -delta;
        const next = Math.min(max, Math.max(min, start.current.size + delta));
        setSize(next);
      }
      function up() {
        setDragging(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setSize((s) => {
          window.localStorage.setItem(storageKey, String(s));
          return s;
        });
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [axis, invert, max, min, size, storageKey]
  );

  return { size, dragging, onPointerDown };
}
