import { jStat } from "jstat";
import { linearRegression } from "./regression";

export interface MediationResult {
  n: number;
  aPath: { beta: number; se: number; p: number };          // X → M
  bPath: { beta: number; se: number; p: number };          // M → Y | X
  cPath: { beta: number; se: number; p: number };          // X → Y (total)
  cPrimePath: { beta: number; se: number; p: number };     // X → Y | M (direct)
  indirect: number;                                         // a*b
  sobel: { z: number; pValue: number };
  bootstrap?: {
    nBoot: number;
    pointEstimate: number;
    ciLower: number;
    ciUpper: number;
    bootstrapMean: number;
    bootstrapSE: number;
  };
  proportionMediated: number;                              // (c-c')/c
  baronKenny: {
    cSignificant: boolean;
    aSignificant: boolean;
    bSignificant: boolean;
    cPrimeReduced: boolean;
    fullMediation: boolean;
  };
}

/**
 * Single-mediator path analysis (Baron & Kenny + Sobel + percentile bootstrap CI).
 * X, M, Y are equal-length arrays aligned by participant.
 */
export function mediation(
  X: number[], M: number[], Y: number[], opts: { nBoot?: number; alpha?: number } = {}
): MediationResult {
  const aligned: [number, number, number][] = [];
  for (let i = 0; i < Math.min(X.length, M.length, Y.length); i++) {
    if (isFinite(X[i]) && isFinite(M[i]) && isFinite(Y[i])) aligned.push([X[i], M[i], Y[i]]);
  }
  const n = aligned.length;
  const x = aligned.map((r) => r[0]);
  const m = aligned.map((r) => r[1]);
  const y = aligned.map((r) => r[2]);

  const a = linearRegression(m, x.map((v) => [v]), ["X"]);
  const c = linearRegression(y, x.map((v) => [v]), ["X"]);
  const both = linearRegression(y, aligned.map((r) => [r[0], r[1]]), ["X", "M"]);

  const aCoef = a.coefficients[1];
  const cCoef = c.coefficients[1];
  const cPrime = both.coefficients[1];
  const bCoef = both.coefficients[2];

  const indirect = aCoef.beta * bCoef.beta;
  const sobelSE = Math.sqrt(
    bCoef.beta ** 2 * aCoef.se ** 2 + aCoef.beta ** 2 * bCoef.se ** 2
  );
  const sobelZ = indirect / sobelSE;
  const sobelP = 2 * (1 - jStat.normal.cdf(Math.abs(sobelZ), 0, 1));

  const alpha = opts.alpha ?? 0.05;
  const nBoot = opts.nBoot ?? 1000;
  const indirects: number[] = [];
  for (let b = 0; b < nBoot; b++) {
    const xb: number[] = [], mb: number[] = [], yb: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * n);
      xb.push(x[idx]); mb.push(m[idx]); yb.push(y[idx]);
    }
    try {
      const aB = linearRegression(mb, xb.map((v) => [v]), ["X"]);
      const bB = linearRegression(yb, xb.map((v, i) => [v, mb[i]]), ["X", "M"]);
      indirects.push(aB.coefficients[1].beta * bB.coefficients[2].beta);
    } catch { /* skip singular */ }
  }
  indirects.sort((p, q) => p - q);
  const ciLower = indirects[Math.floor((alpha / 2) * indirects.length)] ?? NaN;
  const ciUpper = indirects[Math.floor((1 - alpha / 2) * indirects.length)] ?? NaN;
  const bootMean = indirects.reduce((s, v) => s + v, 0) / indirects.length;
  const bootSE = Math.sqrt(indirects.reduce((s, v) => s + (v - bootMean) ** 2, 0) / Math.max(1, indirects.length - 1));

  const propMediated = cCoef.beta !== 0 ? (cCoef.beta - cPrime.beta) / cCoef.beta : NaN;

  const bk = {
    cSignificant: cCoef.pValue < 0.05,
    aSignificant: aCoef.pValue < 0.05,
    bSignificant: bCoef.pValue < 0.05,
    cPrimeReduced: Math.abs(cPrime.beta) < Math.abs(cCoef.beta),
    fullMediation: aCoef.pValue < 0.05 && bCoef.pValue < 0.05 && cPrime.pValue >= 0.05,
  };

  return {
    n,
    aPath: { beta: aCoef.beta, se: aCoef.se, p: aCoef.pValue },
    bPath: { beta: bCoef.beta, se: bCoef.se, p: bCoef.pValue },
    cPath: { beta: cCoef.beta, se: cCoef.se, p: cCoef.pValue },
    cPrimePath: { beta: cPrime.beta, se: cPrime.se, p: cPrime.pValue },
    indirect,
    sobel: { z: sobelZ, pValue: sobelP },
    bootstrap: { nBoot, pointEstimate: indirect, ciLower, ciUpper, bootstrapMean: bootMean, bootstrapSE: bootSE },
    proportionMediated: propMediated,
    baronKenny: bk,
  };
}
