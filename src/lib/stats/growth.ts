import { jStat } from "jstat";
import { summarize, BlockMetrics } from "@/lib/scoring";
import { Trial } from "@/lib/types";

export interface GrowthSeries {
  participantId: string;
  points: { x: number; y: number }[];   // x = block index, y = metric value
  slope: number;
  intercept: number;
  quadratic?: { a: number; b: number; c: number; turningPoint: number | null };
  declineAt: number | null;             // first block index where y < threshold (if any)
}

export interface GroupGrowthResult {
  metric: string;
  threshold: number;
  series: GrowthSeries[];
  group: {
    meanSlope: number;
    sdSlope: number;
    n: number;
    tAgainstZero: number;
    pSlopeAgainstZero: number;
    declineMedian: number | null;
    declineN: number;
    pointMeans: { x: number; mean: number; sd: number; n: number }[];
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SessionLike = any;

export function blockTrajectory(
  sessions: SessionLike[],
  metricKey: keyof Pick<BlockMetrics, "accuracy" | "dPrime" | "rtMean" | "rtMedian" | "hitRate" | "faRate">,
  threshold = 0.7
): GroupGrowthResult {
  const series: GrowthSeries[] = [];
  for (const s of sessions) {
    const blocks = (s.blocks ?? []).slice().sort((a: { blockIndex: number }, b: { blockIndex: number }) => a.blockIndex - b.blockIndex);
    const pts: { x: number; y: number }[] = [];
    for (const b of blocks) {
      const m = summarize((b.trials ?? []) as Trial[]);
      const v = m[metricKey];
      if (v == null || !isFinite(v)) continue;
      pts.push({ x: b.blockIndex, y: v });
    }
    if (pts.length < 2) continue;
    const lin = linearFit(pts);
    const quad = pts.length >= 4 ? quadFit(pts) : undefined;
    const decline = firstBelow(pts, threshold);
    series.push({
      participantId: s.participantId ?? s.takerEmail ?? s.id,
      points: pts, slope: lin.slope, intercept: lin.intercept, quadratic: quad,
      declineAt: decline,
    });
  }
  const slopes = series.map((s) => s.slope).filter(isFinite);
  const meanSlope = slopes.reduce((s, v) => s + v, 0) / Math.max(1, slopes.length);
  const sdSlope = slopes.length > 1
    ? Math.sqrt(slopes.reduce((s, v) => s + (v - meanSlope) ** 2, 0) / (slopes.length - 1))
    : 0;
  const t = sdSlope > 0 ? meanSlope / (sdSlope / Math.sqrt(slopes.length)) : 0;
  const df = Math.max(1, slopes.length - 1);
  const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));

  const declines = series.map((s) => s.declineAt).filter((d): d is number => d != null).sort((a, b) => a - b);
  const declineMedian = declines.length ? declines[Math.floor(declines.length / 2)] : null;

  // Cross-participant means at each block index
  const xs = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x)))).sort((a, b) => a - b);
  const pointMeans = xs.map((x) => {
    const ys = series.flatMap((s) => s.points.filter((p) => p.x === x).map((p) => p.y));
    const n = ys.length;
    const mean = n ? ys.reduce((s, v) => s + v, 0) / n : NaN;
    const sd = n > 1 ? Math.sqrt(ys.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : NaN;
    return { x, mean, sd, n };
  });

  return {
    metric: String(metricKey), threshold, series,
    group: {
      meanSlope, sdSlope, n: slopes.length,
      tAgainstZero: t, pSlopeAgainstZero: p,
      declineMedian, declineN: declines.length, pointMeans,
    },
  };
}

function linearFit(pts: { x: number; y: number }[]) {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  const slope = den > 0 ? num / den : 0;
  return { slope, intercept: my - slope * mx };
}

function quadFit(pts: { x: number; y: number }[]) {
  // y = a x² + b x + c via normal equations
  const n = pts.length;
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0, sy = 0, sxy = 0, sx2y = 0;
  for (const p of pts) {
    const x = p.x, y = p.y;
    sx += x; sx2 += x * x; sx3 += x * x * x; sx4 += x * x * x * x;
    sy += y; sxy += x * y; sx2y += x * x * y;
  }
  const M = [[sx4, sx3, sx2], [sx3, sx2, sx], [sx2, sx, n]];
  const v = [sx2y, sxy, sy];
  let coef: number[];
  try {
    coef = solve3(M, v);
  } catch {
    return { a: 0, b: 0, c: 0, turningPoint: null };
  }
  const [a, b, c] = coef;
  const turningPoint = Math.abs(a) > 1e-12 ? -b / (2 * a) : null;
  return { a, b, c, turningPoint };
}

function solve3(M: number[][], v: number[]): number[] {
  // 3x3 Gaussian elimination
  const A = M.map((row, i) => [...row, v[i]]);
  for (let i = 0; i < 3; i++) {
    let pivot = A[i][i];
    if (Math.abs(pivot) < 1e-12) {
      for (let r = i + 1; r < 3; r++) {
        if (Math.abs(A[r][i]) > 1e-12) { [A[i], A[r]] = [A[r], A[i]]; pivot = A[i][i]; break; }
      }
    }
    if (Math.abs(pivot) < 1e-12) throw new Error("Singular");
    for (let j = 0; j < 4; j++) A[i][j] /= pivot;
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f = A[r][i];
      for (let j = 0; j < 4; j++) A[r][j] -= f * A[i][j];
    }
  }
  return [A[0][3], A[1][3], A[2][3]];
}

function firstBelow(pts: { x: number; y: number }[], threshold: number): number | null {
  for (const p of pts) if (p.y < threshold) return p.x;
  return null;
}
