"use client";
import { useState, useMemo } from "react";
import { blockTrajectory, fmt, fmtP, pStars, type GroupGrowthResult } from "@/lib/stats";
import { ScatterPlot } from "../ScatterPlot";
import { ChartDownload } from "../ChartDownload";
import { StatTable, CsvDownload } from "../ResultTable";

type MetricKey = "accuracy" | "dPrime" | "rtMean" | "rtMedian" | "hitRate" | "faRate";

const METRIC_LABELS: Record<MetricKey, string> = {
  accuracy: "Accuracy", dPrime: "d′", rtMean: "RT mean (ms)",
  rtMedian: "RT median (ms)", hitRate: "Hit rate", faRate: "False-alarm rate",
};

export function GrowthCurveCard({ sessions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[];
}) {
  const [metric, setMetric] = useState<MetricKey>("accuracy");
  const [threshold, setThreshold] = useState(0.7);

  const result = useMemo<GroupGrowthResult | null>(() => {
    if (sessions.length === 0) return null;
    return blockTrajectory(sessions, metric, threshold);
  }, [sessions, metric, threshold]);

  if (!result) return null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[color:var(--muted)]">
        Tracks each metric block-by-block within a session, fits a linear slope per participant,
        and reports the median block index where the metric first drops below threshold.
      </p>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="label text-xs">Metric</span>
          <select className="select" value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
            {Object.entries(METRIC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label text-xs">Decline threshold</span>
          <input type="number" step={0.05} className="input w-32" value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)} />
        </label>
      </div>

      <StatTable rows={[
        { label: "Participants with ≥2 blocks", value: result.group.n },
        { label: "Mean slope (per block)", value: `${fmt(result.group.meanSlope, 4)} ${pStars(result.group.pSlopeAgainstZero)}` },
        { label: "SD of slope", value: fmt(result.group.sdSlope, 4) },
        { label: "t (slope ≠ 0)", value: fmt(result.group.tAgainstZero, 3) },
        { label: "p", value: fmtP(result.group.pSlopeAgainstZero) },
        { label: "Median decline block (< threshold)", value: result.group.declineMedian != null ? `block ${result.group.declineMedian}` : "—" },
        { label: "Participants showing decline", value: `${result.group.declineN} / ${result.group.n}` },
      ]} />

      {result.group.pointMeans.length > 1 && (
        <div>
          <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">
            Group trajectory ({METRIC_LABELS[metric]} vs block index)
          </h5>
          <ChartDownload filename="growth_scatter">
            <ScatterPlot
              x={result.group.pointMeans.map((p) => p.x)}
              y={result.group.pointMeans.map((p) => p.mean)}
              xLabel="Block index" yLabel={METRIC_LABELS[metric]}
            />
          </ChartDownload>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <CsvDownload filename="growth_curve.csv" rows={[
          ["metric", metric], ["threshold", threshold],
          ["mean_slope", result.group.meanSlope], ["sd_slope", result.group.sdSlope],
          ["t_slope_vs_zero", result.group.tAgainstZero], ["p", result.group.pSlopeAgainstZero],
          ["decline_median_block", result.group.declineMedian ?? ""],
          ["decline_n", result.group.declineN], ["n", result.group.n],
          ["participant", "slope", "intercept", "quad_a", "quad_b", "quad_c", "turning_point", "decline_at"],
          ...result.series.map((s) => [
            s.participantId, s.slope, s.intercept,
            s.quadratic?.a ?? "", s.quadratic?.b ?? "", s.quadratic?.c ?? "",
            s.quadratic?.turningPoint ?? "", s.declineAt ?? "",
          ]),
        ]} />
      </div>
    </div>
  );
}
