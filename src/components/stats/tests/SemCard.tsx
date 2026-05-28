"use client";
import { Network } from "lucide-react";

export function SemCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-[color:var(--muted)]">
      <Network className="w-8 h-8 opacity-40" />
      <p className="text-sm font-medium">Structural Equation Modelling</p>
      <p className="text-xs max-w-xs">
        This analysis runs on the analytics service. Open this project in the{" "}
        <strong>Analytics Workbench</strong> to specify your measurement and
        structural model using semopy / lavaan syntax.
      </p>
    </div>
  );
}
