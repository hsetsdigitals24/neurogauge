import { jStat } from "jstat";

export interface TTestResult {
  test: "one-sample" | "independent" | "paired";
  variant?: "welch" | "student";
  n1: number; n2?: number;
  mean1: number; mean2?: number;
  sd1: number; sd2?: number;
  meanDiff: number;
  se: number;
  t: number;
  df: number;
  pValue: number;
  cohenD?: number;
  ciLower: number;
  ciUpper: number;
  alpha: number;
}

function ms(xs: number[]) {
  const n = xs.length;
  const m = xs.reduce((s, v) => s + v, 0) / n;
  const v = n > 1 ? xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1) : 0;
  return { n, mean: m, sd: Math.sqrt(v), v };
}

export function oneSampleT(values: number[], mu0 = 0, alpha = 0.05): TTestResult {
  const xs = values.filter(isFinite);
  const { n, mean, sd } = ms(xs);
  const se = sd / Math.sqrt(n);
  const t = (mean - mu0) / se;
  const df = n - 1;
  const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  const tCrit = jStat.studentt.inv(1 - alpha / 2, df);
  return {
    test: "one-sample", n1: n, mean1: mean, sd1: sd, meanDiff: mean - mu0,
    se, t, df, pValue: p, alpha,
    ciLower: (mean - mu0) - tCrit * se, ciUpper: (mean - mu0) + tCrit * se,
    cohenD: (mean - mu0) / sd,
  };
}

export function independentT(
  a: number[], b: number[], alpha = 0.05, variant: "welch" | "student" = "welch"
): TTestResult {
  const A = ms(a.filter(isFinite));
  const B = ms(b.filter(isFinite));
  let se: number, df: number;
  if (variant === "welch") {
    se = Math.sqrt(A.v / A.n + B.v / B.n);
    df = (A.v / A.n + B.v / B.n) ** 2 /
         ((A.v / A.n) ** 2 / (A.n - 1) + (B.v / B.n) ** 2 / (B.n - 1));
  } else {
    const sp2 = ((A.n - 1) * A.v + (B.n - 1) * B.v) / (A.n + B.n - 2);
    se = Math.sqrt(sp2 * (1 / A.n + 1 / B.n));
    df = A.n + B.n - 2;
  }
  const diff = A.mean - B.mean;
  const t = diff / se;
  const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  const tCrit = jStat.studentt.inv(1 - alpha / 2, df);
  const sp = Math.sqrt(((A.n - 1) * A.v + (B.n - 1) * B.v) / (A.n + B.n - 2));
  return {
    test: "independent", variant,
    n1: A.n, n2: B.n, mean1: A.mean, mean2: B.mean, sd1: A.sd, sd2: B.sd,
    meanDiff: diff, se, t, df, pValue: p, alpha,
    ciLower: diff - tCrit * se, ciUpper: diff + tCrit * se,
    cohenD: diff / sp,
  };
}

export function pairedT(a: number[], b: number[], alpha = 0.05): TTestResult {
  const pairs: number[] = [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (isFinite(a[i]) && isFinite(b[i])) pairs.push(a[i] - b[i]);
  }
  const D = ms(pairs);
  const se = D.sd / Math.sqrt(D.n);
  const t = D.mean / se;
  const df = D.n - 1;
  const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  const tCrit = jStat.studentt.inv(1 - alpha / 2, df);
  return {
    test: "paired", n1: D.n, mean1: D.mean, sd1: D.sd,
    meanDiff: D.mean, se, t, df, pValue: p, alpha,
    ciLower: D.mean - tCrit * se, ciUpper: D.mean + tCrit * se,
    cohenD: D.mean / D.sd,
  };
}
