"use client";
import { FlaskConical } from "lucide-react";

export function ModellingCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-[color:var(--muted)]">
      <FlaskConical className="w-8 h-8 opacity-40" />
      <p className="text-sm font-medium">Statistical Modelling (GLM)</p>
      <p className="text-xs max-w-xs">
        This analysis runs on the analytics service. Open this project in the{" "}
        <strong>Analytics Workbench</strong> to use GLM with Gaussian, Poisson,
        Gamma, or Binomial families.
      </p>
    </div>
  );
}
