import { jStat } from "jstat";

export interface RMAnovaResult {
  conditions: string[];
  k: number;       // number of conditions
  n: number;       // number of subjects
  conditionMeans: { name: string; mean: number; sd: number }[];
  grandMean: number;
  ssBetweenSubjects: number;
  ssWithinSubjects: number;
  ssConditions: number;
  ssError: number;
  dfConditions: number;
  dfError: number;
  msConditions: number;
  msError: number;
  F: number;
  pValue: number;
  partialEtaSq: number;
  greenhouseGeisser?: number;   // ε estimate
  pGG?: number;
}

/**
 * One-way repeated-measures ANOVA. Input is wide-form: each row is a participant,
 * each column is a condition. Missing values cause row to be dropped (listwise).
 */
export function repeatedMeasuresAnova(
  wide: number[][], conditionNames?: string[]
): RMAnovaResult {
  const rows = wide.filter((r) => r.every(isFinite));
  const n = rows.length;
  const k = rows[0]?.length ?? 0;
  const conditions = conditionNames ?? Array.from({ length: k }, (_, i) => `C${i + 1}`);

  const subjMeans = rows.map((r) => r.reduce((s, v) => s + v, 0) / k);
  const condTotals = new Array(k).fill(0);
  for (const r of rows) for (let j = 0; j < k; j++) condTotals[j] += r[j];
  const condMeans = condTotals.map((t) => t / n);
  const grand = rows.flat().reduce((s, v) => s + v, 0) / (n * k);

  let ssBS = 0, ssCond = 0, ssTotal = 0;
  for (let i = 0; i < n; i++) ssBS += k * (subjMeans[i] - grand) ** 2;
  for (let j = 0; j < k; j++) ssCond += n * (condMeans[j] - grand) ** 2;
  for (const r of rows) for (const v of r) ssTotal += (v - grand) ** 2;
  const ssWS = ssTotal - ssBS;
  const ssError = ssWS - ssCond;

  const dfCond = k - 1;
  const dfError = (n - 1) * (k - 1);
  const msCond = ssCond / dfCond;
  const msError = ssError / dfError;
  const F = msCond / msError;
  const pValue = 1 - jStat.centralF.cdf(F, dfCond, dfError);
  const partialEtaSq = ssCond / (ssCond + ssError);

  // Greenhouse-Geisser ε from covariance matrix of conditions
  const eps = greenhouseGeisserEpsilon(rows);
  const dfC2 = dfCond * eps, dfE2 = dfError * eps;
  const pGG = isFinite(eps) ? 1 - jStat.centralF.cdf(F, dfC2, dfE2) : undefined;

  const cMeans = conditions.map((name, j) => {
    const col = rows.map((r) => r[j]);
    const m = col.reduce((s, v) => s + v, 0) / n;
    const sd = Math.sqrt(col.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1));
    return { name, mean: m, sd };
  });

  return {
    conditions, k, n, conditionMeans: cMeans, grandMean: grand,
    ssBetweenSubjects: ssBS, ssWithinSubjects: ssWS, ssConditions: ssCond, ssError,
    dfConditions: dfCond, dfError, msConditions: msCond, msError,
    F, pValue, partialEtaSq, greenhouseGeisser: eps, pGG,
  };
}

function greenhouseGeisserEpsilon(rows: number[][]): number {
  const n = rows.length, k = rows[0].length;
  if (n < 2 || k < 2) return 1;
  const means = new Array(k).fill(0);
  for (const r of rows) for (let j = 0; j < k; j++) means[j] += r[j] / n;
  // Covariance matrix
  const S: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const r of rows) {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        S[i][j] += (r[i] - means[i]) * (r[j] - means[j]) / (n - 1);
      }
    }
  }
  // ε = (tr S - k * mean_diag)² ... use Box's formula via averaged matrix
  // simpler standard formula:
  // ε = [k²(meanDiag - meanAll)²] / [(k-1)(sum_ij S_ij² - 2k*sum_i (rowMean_i)² + k²*meanAll²)]
  let meanDiag = 0, meanAll = 0;
  for (let i = 0; i < k; i++) meanDiag += S[i][i] / k;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) meanAll += S[i][j] / (k * k);
  const rowMeans = new Array(k).fill(0);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) rowMeans[i] += S[i][j] / k;

  let sumSq = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) sumSq += S[i][j] ** 2;
  const sumRowMeanSq = rowMeans.reduce((s, v) => s + v * v, 0);

  const num = k * k * (meanDiag - meanAll) ** 2;
  const den = (k - 1) * (sumSq - 2 * k * sumRowMeanSq + k * k * meanAll * meanAll);
  if (den <= 0) return 1;
  const eps = num / den;
  return Math.max(1 / (k - 1), Math.min(1, eps));
}
