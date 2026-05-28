"use client";
import { useState, useRef, useEffect } from "react";
import { DialogKey } from "@/lib/stats";
import { ChevronDown } from "lucide-react";

const MENU: { group: string; items: { key: DialogKey; label: string }[] }[] = [
  { group: "Descriptive statistics", items: [
    { key: "descriptive", label: "Descriptives" },
    { key: "normality", label: "Normality (S-W, K-S)" },
  ]},
  { group: "Compare means", items: [
    { key: "ttest", label: "T-test" },
    { key: "anova", label: "One-way ANOVA" },
    { key: "anova2", label: "Two-way ANOVA" },
    { key: "rm-anova", label: "Repeated-measures ANOVA" },
  ]},
  { group: "Correlate", items: [
    { key: "correlation", label: "Pearson / Spearman" },
    { key: "chisquare", label: "Chi-square" },
  ]},
  { group: "Regression", items: [
    { key: "regression", label: "Linear regression" },
    { key: "logistic", label: "Logistic regression" },
    { key: "mediation", label: "Mediation" },
  ]},
  { group: "Scale", items: [
    { key: "reliability", label: "Cronbach α" },
    { key: "omega", label: "McDonald's ω" },
    { key: "roc", label: "ROC / AUC" },
  ]},
  { group: "Effect size", items: [
    { key: "effectsize", label: "Cohen d / η² / OR" },
  ]},
  { group: "Time", items: [
    { key: "growth", label: "Growth curves" },
  ]},
  { group: "Advanced models", items: [
    { key: "modelling", label: "Statistical modelling (GLM)" },
    { key: "sem", label: "Structural equation modelling" },
  ]},
];

export function AnalyzeMenu({ onPick }: { onPick: (key: DialogKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button className="btn btn-primary text-xs flex items-center gap-1" onClick={() => setOpen((o) => !o)}>
        Analyze <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-[color:var(--border)] rounded-xl shadow-xl py-2 w-64">
          {MENU.map((group) => (
            <div key={group.group} className="px-2 py-1">
              <div className="text-[10px] uppercase tracking-wide text-[color:var(--muted)] font-semibold px-2 py-1">
                {group.group}
              </div>
              {group.items.map((it) => (
                <button
                  key={it.key}
                  onClick={() => { onPick(it.key); setOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {it.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
