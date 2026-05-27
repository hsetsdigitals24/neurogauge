export interface CronbachResult {
  k: number;
  n: number;
  alpha: number;
  standardizedAlpha: number;
  items: { name: string; itemTotalR: number; alphaIfDeleted: number }[];
}

/**
 * Cronbach's alpha for an item matrix (rows = participants, columns = items).
 * Skips rows with any missing/non-finite item.
 */
export function cronbachAlpha(matrix: number[][], itemNames?: string[]): CronbachResult {
  const rows = matrix.filter((r) => r.every(isFinite));
  const n = rows.length;
  const k = rows[0]?.length ?? 0;
  if (n < 2 || k < 2) {
    return { k, n, alpha: NaN, standardizedAlpha: NaN, items: [] };
  }
  const itemVars = new Array(k).fill(0);
  const itemMeans = new Array(k).fill(0);
  for (let j = 0; j < k; j++) {
    const col = rows.map((r) => r[j]);
    const m = col.reduce((s, v) => s + v, 0) / n;
    itemMeans[j] = m;
    itemVars[j] = col.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1);
  }
  const totals = rows.map((r) => r.reduce((s, v) => s + v, 0));
  const totalMean = totals.reduce((s, v) => s + v, 0) / n;
  const totalVar = totals.reduce((s, v) => s + (v - totalMean) ** 2, 0) / (n - 1);
  const sumItemVar = itemVars.reduce((s, v) => s + v, 0);
  const alpha = (k / (k - 1)) * (1 - sumItemVar / totalVar);

  // Standardized alpha using inter-item correlations
  const corr: number[][] = Array.from({ length: k }, () => new Array(k).fill(1));
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const ci = rows.map((r) => r[i]);
      const cj = rows.map((r) => r[j]);
      corr[i][j] = corr[j][i] = pearson(ci, cj);
    }
  }
  let sumCorr = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (i !== j) sumCorr += corr[i][j];
  const meanCorr = sumCorr / (k * (k - 1));
  const standardizedAlpha = (k * meanCorr) / (1 + (k - 1) * meanCorr);

  const items = Array.from({ length: k }, (_, j) => {
    const itemCol = rows.map((r) => r[j]);
    const restTotals = rows.map((r) => r.reduce((s, v, idx) => s + (idx === j ? 0 : v), 0));
    const itemTotalR = pearson(itemCol, restTotals);
    // alpha-if-deleted
    const otherVars = itemVars.filter((_, i) => i !== j).reduce((s, v) => s + v, 0);
    const restRows = rows.map((r) => r.filter((_, i) => i !== j));
    const restTot = restRows.map((r) => r.reduce((s, v) => s + v, 0));
    const restMean = restTot.reduce((s, v) => s + v, 0) / n;
    const restTotVar = restTot.reduce((s, v) => s + (v - restMean) ** 2, 0) / (n - 1);
    const k2 = k - 1;
    const alphaIfDeleted = (k2 / (k2 - 1)) * (1 - otherVars / restTotVar);
    return { name: itemNames?.[j] ?? `Item ${j + 1}`, itemTotalR, alphaIfDeleted };
  });

  return { k, n, alpha, standardizedAlpha, items };
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const d = Math.sqrt(sxx * syy);
  return d === 0 ? NaN : num / d;
}
