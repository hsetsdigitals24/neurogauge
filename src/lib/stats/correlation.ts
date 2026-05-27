import { jStat } from "jstat";

export interface CorrelationResult {
  method: "pearson" | "spearman";
  n: number;
  r: number;
  t: number;
  df: number;
  pValue: number;
  ciLower: number;
  ciUpper: number;
  alpha: number;
}

export function pearson(x: number[], y: number[], alpha = 0.05): CorrelationResult {
  const pairs = pairwise(x, y);
  const n = pairs.length;
  if (n < 3) return zero("pearson", n, alpha);
  const mx = pairs.reduce((s, [a]) => s + a, 0) / n;
  const my = pairs.reduce((s, [, b]) => s + b, 0) / n;
  let num = 0, sxx = 0, syy = 0;
  for (const [a, b] of pairs) {
    num += (a - mx) * (b - my);
    sxx += (a - mx) ** 2;
    syy += (b - my) ** 2;
  }
  const r = num / Math.sqrt(sxx * syy);
  return inference(r, n, "pearson", alpha);
}

export function spearman(x: number[], y: number[], alpha = 0.05): CorrelationResult {
  const pairs = pairwise(x, y);
  const n = pairs.length;
  if (n < 3) return zero("spearman", n, alpha);
  const rx = ranks(pairs.map((p) => p[0]));
  const ry = ranks(pairs.map((p) => p[1]));
  return inference(pearsonOf(rx, ry), n, "spearman", alpha);
}

function pearsonOf(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return num / Math.sqrt(sxx * syy);
}

function pairwise(x: number[], y: number[]): [number, number][] {
  const n = Math.min(x.length, y.length);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    if (isFinite(x[i]) && isFinite(y[i])) out.push([x[i], y[i]]);
  }
  return out;
}

function ranks(xs: number[]): number[] {
  const indexed = xs.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const r = new Array(xs.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avg = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) r[indexed[k].i] = avg;
    i = j + 1;
  }
  return r;
}

function inference(r: number, n: number, method: "pearson" | "spearman", alpha: number): CorrelationResult {
  const df = n - 2;
  const t = r * Math.sqrt(df / Math.max(1e-12, 1 - r * r));
  const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  // Fisher z transform for CI
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const seZ = 1 / Math.sqrt(n - 3);
  const zCrit = jStat.normal.inv(1 - alpha / 2, 0, 1);
  const zLo = z - zCrit * seZ;
  const zHi = z + zCrit * seZ;
  const ciLower = (Math.exp(2 * zLo) - 1) / (Math.exp(2 * zLo) + 1);
  const ciUpper = (Math.exp(2 * zHi) - 1) / (Math.exp(2 * zHi) + 1);
  return { method, n, r, t, df, pValue: p, ciLower, ciUpper, alpha };
}

function zero(method: "pearson" | "spearman", n: number, alpha: number): CorrelationResult {
  return { method, n, r: NaN, t: NaN, df: NaN, pValue: NaN, ciLower: NaN, ciUpper: NaN, alpha };
}
