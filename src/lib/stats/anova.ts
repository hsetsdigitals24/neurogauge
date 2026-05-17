import { jStat } from "jstat";

export interface AnovaResult {
  groups: { name: string; n: number; mean: number; sd: number }[];
  dfBetween: number;
  dfWithin: number;
  ssBetween: number;
  ssWithin: number;
  msBetween: number;
  msWithin: number;
  F: number;
  pValue: number;
  etaSquared: number;
  omegaSquared: number;
}

export interface PostHocPair {
  groupA: string;
  groupB: string;
  meanDiff: number;
  se: number;
  q?: number;       // Tukey q
  t?: number;       // Bonferroni t
  pValue: number;
  pAdjusted?: number;
  ciLower: number;
  ciUpper: number;
}

export function oneWayAnova(groups: { name: string; values: number[] }[]): AnovaResult {
  const cleaned = groups.map((g) => ({ name: g.name, vs: g.values.filter(isFinite) })).filter((g) => g.vs.length > 0);
  const k = cleaned.length;
  const N = cleaned.reduce((s, g) => s + g.vs.length, 0);
  const grandMean = cleaned.reduce((s, g) => s + g.vs.reduce((t, v) => t + v, 0), 0) / N;

  let ssBetween = 0, ssWithin = 0;
  const groupStats = cleaned.map((g) => {
    const n = g.vs.length;
    const mean = g.vs.reduce((s, v) => s + v, 0) / n;
    const variance = n > 1 ? g.vs.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    ssBetween += n * (mean - grandMean) ** 2;
    ssWithin += (n - 1) * variance;
    return { name: g.name, n, mean, sd: Math.sqrt(variance) };
  });

  const dfBetween = k - 1;
  const dfWithin = N - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const F = msBetween / msWithin;
  const pValue = 1 - jStat.centralF.cdf(F, dfBetween, dfWithin);
  const ssTotal = ssBetween + ssWithin;
  const etaSquared = ssBetween / ssTotal;
  const omegaSquared = (ssBetween - dfBetween * msWithin) / (ssTotal + msWithin);

  return { groups: groupStats, dfBetween, dfWithin, ssBetween, ssWithin,
    msBetween, msWithin, F, pValue, etaSquared, omegaSquared };
}

export function tukeyHSD(
  groups: { name: string; values: number[] }[], alpha = 0.05
): PostHocPair[] {
  const cleaned = groups.map((g) => ({ name: g.name, vs: g.values.filter(isFinite) })).filter((g) => g.vs.length > 0);
  const k = cleaned.length;
  const N = cleaned.reduce((s, g) => s + g.vs.length, 0);
  let ssWithin = 0;
  const groupStats = cleaned.map((g) => {
    const n = g.vs.length;
    const mean = g.vs.reduce((s, v) => s + v, 0) / n;
    const variance = n > 1 ? g.vs.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    ssWithin += (n - 1) * variance;
    return { name: g.name, n, mean };
  });
  const dfWithin = N - k;
  const msWithin = ssWithin / dfWithin;

  const pairs: PostHocPair[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const A = groupStats[i], B = groupStats[j];
      const se = Math.sqrt(msWithin * (1 / A.n + 1 / B.n) / 2);
      const q = Math.abs(A.mean - B.mean) / se;
      const p = 1 - jStat.tukey.cdf(q, k, dfWithin);
      const qCrit = tukeyInv(1 - alpha, k, dfWithin);
      const moe = qCrit * se;
      pairs.push({
        groupA: A.name, groupB: B.name,
        meanDiff: A.mean - B.mean, se, q, pValue: p,
        ciLower: (A.mean - B.mean) - moe, ciUpper: (A.mean - B.mean) + moe,
      });
    }
  }
  return pairs;
}

function tukeyInv(p: number, k: number, df: number): number {
  // Numerical inversion of jStat.tukey.cdf via bisection
  let lo = 0, hi = 20;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (jStat.tukey.cdf(mid, k, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function bonferroniPairwise(
  groups: { name: string; values: number[] }[], alpha = 0.05
): PostHocPair[] {
  const cleaned = groups.map((g) => ({ name: g.name, vs: g.values.filter(isFinite) })).filter((g) => g.vs.length > 0);
  const k = cleaned.length;
  const numComparisons = (k * (k - 1)) / 2;
  const adjustedAlpha = alpha / numComparisons;
  const N = cleaned.reduce((s, g) => s + g.vs.length, 0);
  let ssWithin = 0;
  const groupStats = cleaned.map((g) => {
    const n = g.vs.length;
    const mean = g.vs.reduce((s, v) => s + v, 0) / n;
    const variance = n > 1 ? g.vs.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    ssWithin += (n - 1) * variance;
    return { name: g.name, n, mean };
  });
  const dfWithin = N - k;
  const msWithin = ssWithin / dfWithin;

  const pairs: PostHocPair[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const A = groupStats[i], B = groupStats[j];
      const se = Math.sqrt(msWithin * (1 / A.n + 1 / B.n));
      const t = (A.mean - B.mean) / se;
      const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), dfWithin));
      const pAdj = Math.min(1, p * numComparisons);
      const tCrit = jStat.studentt.inv(1 - adjustedAlpha / 2, dfWithin);
      const moe = tCrit * se;
      pairs.push({
        groupA: A.name, groupB: B.name,
        meanDiff: A.mean - B.mean, se, t, pValue: p, pAdjusted: pAdj,
        ciLower: (A.mean - B.mean) - moe, ciUpper: (A.mean - B.mean) + moe,
      });
    }
  }
  return pairs;
}
