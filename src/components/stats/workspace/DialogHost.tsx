"use client";
import { useRef } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { DialogKey } from "@/lib/stats";
import { Save, X } from "lucide-react";

import { DescriptiveCard } from "../tests/DescriptiveCard";
import { NormalityCard } from "../tests/NormalityCard";
import { TTestCard } from "../tests/TTestCard";
import { AnovaCard } from "../tests/AnovaCard";
import { CorrelationCard } from "../tests/CorrelationCard";
import { ChiSquareCard } from "../tests/ChiSquareCard";
import { RegressionCard } from "../tests/RegressionCard";
import { LogisticRegressionCard } from "../tests/LogisticRegressionCard";
import { ReliabilityCard } from "../tests/ReliabilityCard";
import { EffectSizeCard } from "../tests/EffectSizeCard";
import { RocCard } from "../tests/RocCard";
import { TwoWayAnovaCard } from "../tests/TwoWayAnovaCard";
import { RepeatedMeasuresCard } from "../tests/RepeatedMeasuresCard";
import { OmegaCard } from "../tests/OmegaCard";
import { GrowthCurveCard } from "../tests/GrowthCurveCard";
import { MediationCard } from "../tests/MediationCard";

const TITLE: Record<DialogKey, string> = {
  descriptive: "Descriptives",
  normality: "Normality test",
  ttest: "T-test",
  anova: "One-way ANOVA",
  correlation: "Correlation",
  chisquare: "Chi-square",
  regression: "Linear regression",
  logistic: "Logistic regression",
  reliability: "Cronbach α",
  effectsize: "Effect size",
  roc: "ROC / AUC",
  anova2: "Two-way ANOVA",
  "rm-anova": "Repeated-measures ANOVA",
  omega: "McDonald's ω",
  growth: "Growth curves",
  mediation: "Mediation analysis",
};

export function DialogHost({ dialogKey }: { dialogKey: DialogKey }) {
  const ws = useWorkspace();
  const bodyRef = useRef<HTMLDivElement>(null);

  function saveToLog() {
    const node = bodyRef.current;
    if (!node) return;
    const html = node.innerHTML;
    if (!html.trim()) return;
    ws.appendOutput({
      title: TITLE[dialogKey],
      test: dialogKey,
      htmlSnapshot: html,
    });
  }

  // The cards retain their original prop signature for back-compat;
  // they internally consume the workspace via useExtract() / WorkspaceProvider.
  const cardProps = { sessions: ws.sessions, catalog: ws.catalog, questions: ws.questions };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
        <h3 className="font-bold">{TITLE[dialogKey]}</h3>
        <div className="flex gap-2">
          <button onClick={saveToLog} className="btn btn-primary text-xs flex items-center gap-1">
            <Save className="w-3.5 h-3.5" /> Run & save to output
          </button>
          <button onClick={() => ws.dispatch({ type: "openDialog", key: null })}
            className="btn btn-ghost text-xs flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div ref={bodyRef}>
          {dialogKey === "descriptive" && <DescriptiveCard {...cardProps} />}
          {dialogKey === "normality" && <NormalityCard {...cardProps} />}
          {dialogKey === "ttest" && <TTestCard {...cardProps} />}
          {dialogKey === "anova" && <AnovaCard {...cardProps} />}
          {dialogKey === "correlation" && <CorrelationCard {...cardProps} />}
          {dialogKey === "chisquare" && <ChiSquareCard {...cardProps} />}
          {dialogKey === "regression" && <RegressionCard {...cardProps} />}
          {dialogKey === "logistic" && <LogisticRegressionCard {...cardProps} />}
          {dialogKey === "reliability" && <ReliabilityCard {...cardProps} />}
          {dialogKey === "effectsize" && <EffectSizeCard {...cardProps} />}
          {dialogKey === "roc" && <RocCard {...cardProps} />}
          {dialogKey === "anova2" && <TwoWayAnovaCard {...cardProps} />}
          {dialogKey === "rm-anova" && <RepeatedMeasuresCard {...cardProps} />}
          {dialogKey === "omega" && <OmegaCard {...cardProps} />}
          {dialogKey === "growth" && <GrowthCurveCard sessions={ws.sessions} />}
          {dialogKey === "mediation" && <MediationCard {...cardProps} />}
        </div>
      </div>
    </div>
  );
}
