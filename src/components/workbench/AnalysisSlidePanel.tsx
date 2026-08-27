"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useWorkspace } from "@/components/stats/workspace/WorkspaceProvider";
import { DialogHost } from "@/components/stats/workspace/DialogHost";

export function AnalysisSlidePanel() {
  const ws = useWorkspace();
  const activeDialog = ws.state.activeDialog;

  // Close the popup on Escape.
  useEffect(() => {
    if (!activeDialog) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") ws.dispatch({ type: "openDialog", key: null });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeDialog, ws]);

  return (
    <AnimatePresence>
      {activeDialog && (
        <motion.div
          key="dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(e) => {
            // Click on the backdrop (not the dialog body) closes the popup.
            if (e.target === e.currentTarget) ws.dispatch({ type: "openDialog", key: null });
          }}
        >
          <motion.div
            key="dialog-box"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-[color:var(--border)]"
          >
            <DialogHost dialogKey={activeDialog} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
