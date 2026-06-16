"use client";
import { useRef } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { DialogKey } from "@/lib/stats";
import { Save, X } from "lucide-react";
import { useWorkbenchOptional } from "@/contexts/WorkbenchContext";
import { BACKEND_CONFIG } from "@/lib/analytics/backendConfig";
import { BackendAnalysisForm } from "@/components/workbench/BackendAnalysisForm";

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
import { ModellingCard } from "../tests/ModellingCard";
import { SemCard } from "../tests/SemCard";

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
  "mann-whitney": "Mann–Whitney U test",
  wilcoxon: "Wilcoxon signed-rank test",
  "kruskal-wallis": "Kruskal–Wallis test",
  friedman: "Friedman test",
  factor: "Factor analysis (EFA)",
  irt: "Item response theory (IRT)",
  modelling: "Statistical modelling (GLM)",
  sem: "Structural equation modelling",
};

export function DialogHost({ dialogKey }: { dialogKey: DialogKey }) {
  const ws = useWorkspace();
  const wb = useWorkbenchOptional();
  const bodyRef = useRef<HTMLDivElement>(null);

  const backendConfig = BACKEND_CONFIG[dialogKey];
  const useBackend = wb != null && backendConfig != null;

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
          {!useBackend && (
            <button onClick={saveToLog} className="btn btn-primary text-xs flex items-center gap-1">
              <Save className="w-3.5 h-3.5" /> Run & save to output
            </button>
          )}
          {useBackend && (
            <button onClick={saveToLog} className="btn btn-ghost text-xs flex items-center gap-1">
              <Save className="w-3.5 h-3.5" /> Save to output
            </button>
          )}
          <button onClick={() => ws.dispatch({ type: "openDialog", key: null })}
            className="btn btn-ghost text-xs flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div ref={bodyRef}>
          {/* In workbench context with a backend config: use Python backend form */}
          {useBackend && (
            <BackendAnalysisForm
              dialogKey={dialogKey}
              config={backendConfig}
              source={wb.source}
              dataRows={wb.filteredRows}
              schema={wb.state.schema}
            />
          )}

          {/* Fallback: client-side cards (no workbench context, or no backend config) */}
          {!useBackend && dialogKey === "descriptive" && <DescriptiveCard {...cardProps} />}
          {!useBackend && dialogKey === "normality" && <NormalityCard {...cardProps} />}
          {!useBackend && dialogKey === "ttest" && <TTestCard {...cardProps} />}
          {!useBackend && dialogKey === "anova" && <AnovaCard {...cardProps} />}
          {!useBackend && dialogKey === "correlation" && <CorrelationCard {...cardProps} />}
          {!useBackend && dialogKey === "chisquare" && <ChiSquareCard {...cardProps} />}
          {!useBackend && dialogKey === "regression" && <RegressionCard {...cardProps} />}
          {!useBackend && dialogKey === "logistic" && <LogisticRegressionCard {...cardProps} />}
          {!useBackend && dialogKey === "reliability" && <ReliabilityCard {...cardProps} />}
          {!useBackend && dialogKey === "effectsize" && <EffectSizeCard {...cardProps} />}
          {!useBackend && dialogKey === "roc" && <RocCard {...cardProps} />}
          {!useBackend && dialogKey === "anova2" && <TwoWayAnovaCard {...cardProps} />}
          {!useBackend && dialogKey === "rm-anova" && <RepeatedMeasuresCard {...cardProps} />}
          {!useBackend && dialogKey === "omega" && <OmegaCard {...cardProps} />}
          {!useBackend && dialogKey === "growth" && <GrowthCurveCard sessions={ws.sessions} />}
          {!useBackend && dialogKey === "mediation" && <MediationCard {...cardProps} />}
          {!useBackend && dialogKey === "modelling" && <ModellingCard />}
          {!useBackend && dialogKey === "sem" && <SemCard />}

        </div>
      </div>
    </div>
  );
}
