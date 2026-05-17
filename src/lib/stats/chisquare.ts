import { jStat } from "jstat";

export interface ChiSquareResult {
  kind: "goodness-of-fit" | "independence";
  chi2: number;
  df: number;
  pValue: number;
  cramersV?: number;
  rowLabels?: string[];
  colLabels?: string[];
  observed: number[][];
  expected: number[][];
  n: number;
}

export function chiSquareGOF(observed: number[], expected?: number[]): ChiSquareResult {
  const k = observed.length;
  const total = observed.reduce((s, v) => s + v, 0);
  const exp = expected ?? observed.map(() => total / k);
  let chi2 = 0;
  for (let i = 0; i < k; i++) {
    if (exp[i] > 0) chi2 += (observed[i] - exp[i]) ** 2 / exp[i];
  }
  const df = k - 1;
  const p = 1 - jStat.chisquare.cdf(chi2, df);
  return {
    kind: "goodness-of-fit", chi2, df, pValue: p,
    observed: [observed], expected: [exp], n: total,
  };
}

export function chiSquareIndependence(
  table: number[][], rowLabels?: string[], colLabels?: string[]
): ChiSquareResult {
  const r = table.length;
  const c = table[0]?.length ?? 0;
  const rowTotals = table.map((row) => row.reduce((s, v) => s + v, 0));
  const colTotals: number[] = new Array(c).fill(0);
  for (const row of table) for (let j = 0; j < c; j++) colTotals[j] += row[j];
  const n = rowTotals.reduce((s, v) => s + v, 0);
  const expected: number[][] = table.map((_, i) => colTotals.map((ct) => (rowTotals[i] * ct) / n));
  let chi2 = 0;
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      if (expected[i][j] > 0) chi2 += (table[i][j] - expected[i][j]) ** 2 / expected[i][j];
    }
  }
  const df = (r - 1) * (c - 1);
  const p = 1 - jStat.chisquare.cdf(chi2, df);
  const cramersV = Math.sqrt(chi2 / (n * Math.min(r - 1, c - 1)));
  return {
    kind: "independence", chi2, df, pValue: p, cramersV,
    observed: table, expected, rowLabels, colLabels, n,
  };
}

/** Build a contingency table from two parallel categorical arrays. */
export function contingencyTable(
  rows: string[], cols: string[]
): { rowLabels: string[]; colLabels: string[]; table: number[][] } {
  const rowSet = Array.from(new Set(rows)).sort();
  const colSet = Array.from(new Set(cols)).sort();
  const rIdx = new Map(rowSet.map((v, i) => [v, i]));
  const cIdx = new Map(colSet.map((v, i) => [v, i]));
  const table: number[][] = rowSet.map(() => colSet.map(() => 0));
  for (let i = 0; i < rows.length; i++) {
    const r = rIdx.get(rows[i]); const c = cIdx.get(cols[i]);
    if (r != null && c != null) table[r][c]++;
  }
  return { rowLabels: rowSet, colLabels: colSet, table };
}
