import { jStat } from "jstat";
import { percentile } from "./descriptive";

export interface NormalityResult {
  n: number;
  test: "shapiro-wilk" | "kolmogorov-smirnov";
  statistic: number;
  pValue: number;
  reject05: boolean;
}

/**
 * Shapiro-Wilk normality test using the Royston (1992) approximation.
 * Valid for 3 ≤ n ≤ 5000.
 */
export function shapiroWilk(values: number[]): NormalityResult {
  const xs = values.filter(isFinite).slice().sort((a, b) => a - b);
  const n = xs.length;
  if (n < 3) {
    return { n, test: "shapiro-wilk", statistic: NaN, pValue: NaN, reject05: false };
  }
  const mean = xs.reduce((s, v) => s + v, 0) / n;
  const ss = xs.reduce((s, v) => s + (v - mean) ** 2, 0);
  if (ss === 0) return { n, test: "shapiro-wilk", statistic: 1, pValue: 1, reject05: false };

  // Compute a-coefficients via Royston approximation
  const m = new Array(n);
  for (let i = 0; i < n; i++) {
    m[i] = jStat.normal.inv((i + 1 - 3 / 8) / (n + 1 / 4), 0, 1);
  }
  const m2 = m.reduce((s, v) => s + v * v, 0);
  const u = 1 / Math.sqrt(n);
  const an = -2.706056 * u ** 5 + 4.434685 * u ** 4 - 2.071190 * u ** 3 - 0.147981 * u ** 2 + 0.221157 * u + m[n - 1] / Math.sqrt(m2);
  const an1 = -3.582633 * u ** 5 + 5.682633 * u ** 4 - 1.752460 * u ** 3 - 0.293762 * u ** 2 + 0.042981 * u + m[n - 2] / Math.sqrt(m2);

  const a = new Array(n);
  if (n === 3) {
    a[0] = 1 / Math.sqrt(2);
    a[2] = -a[0];
    a[1] = 0;
  } else {
    const eps = (m2 - 2 * m[n - 1] ** 2 - (n > 5 ? 2 * m[n - 2] ** 2 : 0)) /
                (1 - 2 * an ** 2 - (n > 5 ? 2 * an1 ** 2 : 0));
    a[n - 1] = an;
    a[0] = -an;
    if (n > 5) {
      a[n - 2] = an1;
      a[1] = -an1;
      for (let i = 2; i < n - 2; i++) a[i] = m[i] / Math.sqrt(eps);
    } else {
      for (let i = 1; i < n - 1; i++) a[i] = m[i] / Math.sqrt(eps);
    }
  }

  let num = 0;
  for (let i = 0; i < n; i++) num += a[i] * xs[i];
  const W = (num * num) / ss;

  // Royston p-value approximation
  let mu = 0, sigma = 1, p = 1;
  if (n <= 11) {
    const gamma = -2.273 + 0.459 * n;
    mu = 0.5440 - 0.39978 * n + 0.025054 * n * n - 0.0006714 * n * n * n;
    const lnSigma = 1.3822 - 0.77857 * n + 0.062767 * n * n - 0.0020322 * n * n * n;
    sigma = Math.exp(lnSigma);
    const y = -Math.log(gamma - Math.log(1 - W));
    p = 1 - jStat.normal.cdf((y - mu) / sigma, 0, 1);
  } else {
    const lnN = Math.log(n);
    mu = -1.5861 - 0.31082 * lnN - 0.083751 * lnN * lnN + 0.0038915 * lnN * lnN * lnN;
    const lnSigma = -0.4803 - 0.082676 * lnN + 0.0030302 * lnN * lnN;
    sigma = Math.exp(lnSigma);
    const y = Math.log(1 - W);
    p = 1 - jStat.normal.cdf((y - mu) / sigma, 0, 1);
  }
  p = Math.max(0, Math.min(1, p));
  return { n, test: "shapiro-wilk", statistic: W, pValue: p, reject05: p < 0.05 };
}

/** One-sample Kolmogorov-Smirnov test vs N(mean, sd) of the data. */
export function ksNormal(values: number[]): NormalityResult {
  const xs = values.filter(isFinite).slice().sort((a, b) => a - b);
  const n = xs.length;
  if (n < 3) return { n, test: "kolmogorov-smirnov", statistic: NaN, pValue: NaN, reject05: false };
  const mean = xs.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  if (sd === 0) return { n, test: "kolmogorov-smirnov", statistic: 0, pValue: 1, reject05: false };
  let D = 0;
  for (let i = 0; i < n; i++) {
    const Fexp = jStat.normal.cdf(xs[i], mean, sd);
    const Femp1 = (i + 1) / n;
    const Femp0 = i / n;
    D = Math.max(D, Math.abs(Femp1 - Fexp), Math.abs(Fexp - Femp0));
  }
  // Kolmogorov distribution two-sided p (Marsaglia-style series)
  const en = Math.sqrt(n);
  const lambda = (en + 0.12 + 0.11 / en) * D;
  const p = ksPValue(lambda);
  return { n, test: "kolmogorov-smirnov", statistic: D, pValue: p, reject05: p < 0.05 };
}

function ksPValue(lambda: number): number {
  if (lambda <= 0) return 1;
  let sum = 0;
  for (let k = 1; k <= 100; k++) {
    const term = 2 * (-1) ** (k - 1) * Math.exp(-2 * k * k * lambda * lambda);
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }
  return Math.max(0, Math.min(1, sum));
}

export interface HistogramBin { lo: number; hi: number; count: number; }

export function histogram(values: number[], bins?: number): HistogramBin[] {
  const xs = values.filter(isFinite);
  const n = xs.length;
  if (n === 0) return [];
  const sorted = [...xs].sort((a, b) => a - b);
  const min = sorted[0], max = sorted[n - 1];
  if (min === max) return [{ lo: min, hi: max + 1, count: n }];
  // Freedman-Diaconis if bins not given
  let k = bins;
  if (!k) {
    const iqr = percentile(sorted, 0.75) - percentile(sorted, 0.25);
    const width = iqr > 0 ? 2 * iqr / Math.cbrt(n) : (max - min) / Math.sqrt(n);
    k = Math.max(5, Math.min(40, Math.ceil((max - min) / width)));
  }
  const step = (max - min) / k;
  const out: HistogramBin[] = Array.from({ length: k }, (_, i) => ({
    lo: min + i * step, hi: min + (i + 1) * step, count: 0,
  }));
  for (const v of xs) {
    let idx = Math.floor((v - min) / step);
    if (idx >= k) idx = k - 1;
    out[idx].count++;
  }
  return out;
}

export interface QQPoint { theoretical: number; sample: number; }

export function qqNormalPoints(values: number[]): QQPoint[] {
  const xs = values.filter(isFinite).slice().sort((a, b) => a - b);
  const n = xs.length;
  return xs.map((v, i) => ({
    theoretical: jStat.normal.inv((i + 0.5) / n, 0, 1),
    sample: v,
  }));
}
