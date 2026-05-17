import { jStat } from "jstat";

export interface Descriptives {
  n: number;
  mean: number;
  median: number;
  mode: number[];
  sd: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  sem: number;
  ci95Lower: number;
  ci95Upper: number;
}

export function descriptives(values: number[]): Descriptives {
  const xs = values.filter((v) => isFinite(v));
  const n = xs.length;
  if (n === 0) {
    return { n: 0, mean: NaN, median: NaN, mode: [], sd: NaN, variance: NaN,
      min: NaN, max: NaN, range: NaN, q1: NaN, q3: NaN, iqr: NaN,
      skewness: NaN, kurtosis: NaN, sem: NaN, ci95Lower: NaN, ci95Upper: NaN };
  }
  const sorted = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? xs.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const median = percentile(sorted, 0.5);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const mode = modeOf(xs);
  const skewness = n > 2 ? (xs.reduce((s, v) => s + ((v - mean) / sd) ** 3, 0) * n) / ((n - 1) * (n - 2)) : NaN;
  const kurtosis = n > 3 ? kurtExcess(xs, mean, sd, n) : NaN;
  const sem = sd / Math.sqrt(n);
  const tCrit = n > 1 ? jStat.studentt.inv(0.975, n - 1) : NaN;
  const ci95Lower = mean - tCrit * sem;
  const ci95Upper = mean + tCrit * sem;
  return {
    n, mean, median, mode, sd, variance,
    min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0],
    q1, q3, iqr: q3 - q1, skewness, kurtosis, sem, ci95Lower, ci95Upper,
  };
}

export function percentile(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedAsc[0];
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

function modeOf(xs: number[]): number[] {
  const counts = new Map<number, number>();
  for (const v of xs) counts.set(v, (counts.get(v) ?? 0) + 1);
  let max = 0;
  for (const c of counts.values()) if (c > max) max = c;
  if (max <= 1) return [];
  return [...counts.entries()].filter(([, c]) => c === max).map(([v]) => v).sort((a, b) => a - b);
}

function kurtExcess(xs: number[], mean: number, sd: number, n: number): number {
  const m4 = xs.reduce((s, v) => s + ((v - mean) / sd) ** 4, 0);
  const a = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  const b = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return a * m4 - b;
}

export function ciMean(values: number[], alpha = 0.05): { lower: number; upper: number; mean: number; sem: number } {
  const xs = values.filter(isFinite);
  const n = xs.length;
  const mean = xs.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  const sem = sd / Math.sqrt(n);
  const t = jStat.studentt.inv(1 - alpha / 2, n - 1);
  return { lower: mean - t * sem, upper: mean + t * sem, mean, sem };
}
