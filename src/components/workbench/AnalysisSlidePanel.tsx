"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useWorkspace } from "@/components/stats/workspace/WorkspaceProvider";
import { DialogHost } from "@/components/stats/workspace/DialogHost";

export function AnalysisSlidePanel() {
  const ws = useWorkspace();
  const activeDialog = ws.state.activeDialog;

  return (
    <AnimatePresence>
      {activeDialog && (
        <motion.div
          key="slide-panel"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute inset-y-0 right-0 z-20 w-full md:w-[420px] flex flex-col bg-white border-l border-[color:var(--border)] shadow-2xl"
        >
          <DialogHost dialogKey={activeDialog} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
