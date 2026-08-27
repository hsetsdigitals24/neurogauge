"use client";
import { useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import type { AnalysisResponse } from "@/lib/analytics/client";
import { friendlyAnalysisError } from "@/lib/analytics/friendlyError";
import { BackendResultPanel } from "./BackendResultPanel";

type SolveFor = "n" | "power" | "effect_size";

interface TestMeta {
  key: string;
  label: string;
  /** Effect-size metric name shown next to the input. */
  effect: string;
  /** Cohen's small / medium / large benchmarks for a hint line. */
  benchmarks: [number, number, number];
  needsGroups?: boolean; // one-way ANOVA
  needsDf?: boolean; // chi-square
  twoGroup?: boolean; // per-group n + allocation ratio + tails
  hasTails?: boolean; // alternative applies
}

const TESTS: TestMeta[] = [
  { key: "ttest-two", label: "Independent two-sample t-test", effect: "Cohen's d", benchmarks: [0.2, 0.5, 0.8], twoGroup: true, hasTails: true },
  { key: "ttest-paired", label: "Paired t-test", effect: "Cohen's d", benchmarks: [0.2, 0.5, 0.8], hasTails: true },
  { key: "ttest-one", label: "One-sample t-test", effect: "Cohen's d", benchmarks: [0.2, 0.5, 0.8], hasTails: true },
  { key: "anova", label: "One-way ANOVA", effect: "Cohen's f", benchmarks: [0.1, 0.25, 0.4], needsGroups: true },
  { key: "correlation", label: "Correlation (Pearson r)", effect: "r", benchmarks: [0.1, 0.3, 0.5], hasTails: true },
  { key: "chi-square", label: "Chi-square test", effect: "Cohen's w", benchmarks: [0.1, 0.3, 0.5], needsDf: true },
  { key: "proportion-two", label: "Two-proportion z-test", effect: "Cohen's h", benchmarks: [0.2, 0.5, 0.8], twoGroup: true, hasTails: true },
];

const SOLVE_LABEL: Record<SolveFor, string> = {
  n: "Sample size (n)",
  power: "Power (1 − β)",
  effect_size: "Min. detectable effect",
};

export function PowerAnalysisCard() {
  const [testKey, setTestKey] = useState("ttest-two");
  const [solveFor, setSolveFor] = useState<SolveFor>("n");
  const [effectSize, setEffectSize] = useState(0.5);
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.8);
  const [n, setN] = useState(64);
  const [kGroups, setKGroups] = useState(3);
  const [df, setDf] = useState(1);
  const [ratio, setRatio] = useState(1);
  const [alternative, setAlternative] = useState("two-sided");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const test = useMemo(() => TESTS.find((t) => t.key === testKey)!, [testKey]);
  const [sm, md, lg] = test.benchmarks;
  const nLabel = test.twoGroup ? "n per group" : "n (total)";

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/power", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test: testKey,
          solveFor,
          effectSize: solveFor === "effect_size" ? null : effectSize,
          alpha,
          power: solveFor === "power" ? null : power,
          n: solveFor === "n" ? null : n,
          kGroups: test.needsGroups ? kGroups : null,
          df: test.needsDf ? df : null,
          ratio: test.twoGroup ? ratio : 1,
          alternative: test.hasTails ? alternative : "two-sided",
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try { msg = JSON.parse(text).detail ?? JSON.parse(text).error ?? text; } catch { /* raw */ }
        throw new Error(msg || `Failed (${res.status})`);
      }
      setResult(JSON.parse(text) as AnalysisResponse);
    } catch (e) {
      setError(friendlyAnalysisError(e, "Sample size & power couldn't be computed. Please review your inputs and try again."));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[color:var(--muted)] leading-relaxed">
        Plan a study before collecting data. Pick a test, enter the smallest effect worth detecting,
        and solve for the sample size you need (or the power / minimum effect a given n affords).
        No dataset required.
      </p>

      {/* Test */}
      <label className="block">
        <span className="label text-xs">Statistical test</span>
        <select className="select text-xs" value={testKey} onChange={(e) => setTestKey(e.target.value)}>
          {TESTS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </label>

      {/* Solve for */}
      <div>
        <span className="label text-xs">Solve for</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {(Object.keys(SOLVE_LABEL) as SolveFor[]).map((sf) => (
            <label key={sf} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="radio" name="solveFor" checked={solveFor === sf} onChange={() => setSolveFor(sf)} />
              {SOLVE_LABEL[sf]}
            </label>
          ))}
        </div>
      </div>

      {/* Effect size — hidden when solving for it */}
      {solveFor !== "effect_size" && (
        <label className="block">
          <span className="label text-xs">Effect size ({test.effect})</span>
          <input
            type="number" step="0.01" min="0" className="input text-xs"
            value={effectSize} onChange={(e) => setEffectSize(parseFloat(e.target.value) || 0)}
          />
          <span className="text-[10px] text-[color:var(--muted)]">
            Convention — small {sm}, medium {md}, large {lg}
          </span>
        </label>
      )}

      {/* Target power — hidden when solving for it */}
      {solveFor !== "power" && (
        <label className="block">
          <span className="label text-xs">Target power (1 − β)</span>
          <input
            type="number" step="0.05" min="0" max="0.999" className="input text-xs"
            value={power} onChange={(e) => setPower(parseFloat(e.target.value) || 0)}
          />
          <span className="text-[10px] text-[color:var(--muted)]">Conventionally 0.80 or 0.90</span>
        </label>
      )}

      {/* Sample size — shown only when NOT solving for n */}
      {solveFor !== "n" && (
        <label className="block">
          <span className="label text-xs">{nLabel}</span>
          <input
            type="number" step="1" min="2" className="input text-xs"
            value={n} onChange={(e) => setN(parseInt(e.target.value) || 0)}
          />
        </label>
      )}

      {/* α */}
      <label className="block">
        <span className="label text-xs">α (significance)</span>
        <select className="select text-xs" value={alpha} onChange={(e) => setAlpha(parseFloat(e.target.value))}>
          <option value={0.05}>0.05</option>
          <option value={0.01}>0.01</option>
          <option value={0.1}>0.10</option>
        </select>
      </label>

      {/* Per-test extras */}
      {test.needsGroups && (
        <label className="block">
          <span className="label text-xs">Number of groups (k)</span>
          <input
            type="number" step="1" min="2" className="input text-xs"
            value={kGroups} onChange={(e) => setKGroups(parseInt(e.target.value) || 2)}
          />
        </label>
      )}
      {test.needsDf && (
        <label className="block">
          <span className="label text-xs">Degrees of freedom</span>
          <input
            type="number" step="1" min="1" className="input text-xs"
            value={df} onChange={(e) => setDf(parseInt(e.target.value) || 1)}
          />
          <span className="text-[10px] text-[color:var(--muted)]">
            (rows − 1) × (columns − 1); 1 for a 2×2 table
          </span>
        </label>
      )}
      {test.twoGroup && (
        <label className="block">
          <span className="label text-xs">Allocation ratio (group 2 / group 1)</span>
          <input
            type="number" step="0.1" min="0.1" className="input text-xs"
            value={ratio} onChange={(e) => setRatio(parseFloat(e.target.value) || 1)}
          />
        </label>
      )}
      {test.hasTails && (
        <label className="block">
          <span className="label text-xs">Alternative</span>
          <select className="select text-xs" value={alternative} onChange={(e) => setAlternative(e.target.value)}>
            <option value="two-sided">Two-sided</option>
            <option value="greater">One-sided (greater)</option>
            <option value="less">One-sided (less)</option>
          </select>
        </label>
      )}

      <div className="pt-1">
        <button
          className="btn btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
          disabled={loading}
          onClick={run}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {loading ? "Calculating…" : "Calculate"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-xs text-red-700 border border-red-100">{error}</div>
      )}

      {result && (
        <BackendResultPanel
          result={result}
          analysis={{
            label: `Power analysis — ${test.label}`,
            options: { solveFor, alpha, effect: test.effect },
          }}
        />
      )}
    </div>
  );
}
