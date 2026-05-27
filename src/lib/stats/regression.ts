import { jStat } from "jstat";

export interface LinearRegressionResult {
  n: number;
  k: number; // number of predictors (excl. intercept)
  predictors: string[];
  coefficients: {
    name: string;
    beta: number;
    se: number;
    t: number;
    pValue: number;
    ciLower: number;
    ciUpper: number;
    stdBeta?: number;
  }[];
  rSquared: number;
  adjRSquared: number;
  F: number;
  pValueF: number;
  dfModel: number;
  dfResidual: number;
  residuals: number[];
  fitted: number[];
  alpha: number;
}

export interface LogisticRegressionResult {
  n: number;
  predictors: string[];
  coefficients: {
    name: string;
    beta: number;
    se: number;
    z: number;
    pValue: number;
    oddsRatio: number;
    ciLower: number;
    ciUpper: number;
  }[];
  pseudoR2: number; // McFadden
  logLik: number;
  logLikNull: number;
  iterations: number;
  converged: boolean;
  confusion: { TP: number; FP: number; TN: number; FN: number };
  accuracy: number;
  alpha: number;
}

// === Linear regression (OLS via normal equations) ===
export function linearRegression(
  y: number[], X: number[][], predictorNames: string[], alpha = 0.05
): LinearRegressionResult {
  // X is rows of predictors WITHOUT intercept
  const rows: number[][] = [];
  const yClean: number[] = [];
  for (let i = 0; i < y.length; i++) {
    if (!isFinite(y[i])) continue;
    if (X[i].some((v) => !isFinite(v))) continue;
    rows.push([1, ...X[i]]);
    yClean.push(y[i]);
  }
  const n = rows.length;
  const p = rows[0]?.length ?? 0; // includes intercept
  const k = p - 1;
  const Xt = transpose(rows);
  const XtX = multiply(Xt, rows);
  const XtXInv = invert(XtX);
  const Xty = multiplyVec(Xt, yClean);
  const beta = multiplyVec(XtXInv, Xty);

  const fitted = rows.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const residuals = yClean.map((yi, i) => yi - fitted[i]);
  const yMean = yClean.reduce((s, v) => s + v, 0) / n;
  const ssTotal = yClean.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const ssReg = ssTotal - ssRes;
  const rSquared = 1 - ssRes / ssTotal;
  const adjRSquared = 1 - (1 - rSquared) * (n - 1) / (n - p);
  const dfModel = k;
  const dfResidual = n - p;
  const sigma2 = ssRes / dfResidual;
  const F = (ssReg / dfModel) / (ssRes / dfResidual);
  const pValueF = dfModel > 0 ? 1 - jStat.centralF.cdf(F, dfModel, dfResidual) : NaN;

  const names = ["(Intercept)", ...predictorNames];
  // Standardized betas for non-intercept terms
  const sdY = Math.sqrt(yClean.reduce((s, v) => s + (v - yMean) ** 2, 0) / (n - 1));
  const sdX = predictorNames.map((_, j) => {
    const col = X.map((row) => row[j]).filter(isFinite);
    const m = col.reduce((s, v) => s + v, 0) / col.length;
    return Math.sqrt(col.reduce((s, v) => s + (v - m) ** 2, 0) / (col.length - 1));
  });

  const tCrit = jStat.studentt.inv(1 - alpha / 2, dfResidual);
  const coefficients = names.map((name, i) => {
    const se = Math.sqrt(sigma2 * XtXInv[i][i]);
    const t = beta[i] / se;
    const pv = 2 * (1 - jStat.studentt.cdf(Math.abs(t), dfResidual));
    return {
      name, beta: beta[i], se, t, pValue: pv,
      ciLower: beta[i] - tCrit * se, ciUpper: beta[i] + tCrit * se,
      stdBeta: i === 0 ? undefined : beta[i] * (sdX[i - 1] / sdY),
    };
  });

  return { n, k, predictors: predictorNames, coefficients,
    rSquared, adjRSquared, F, pValueF, dfModel, dfResidual,
    residuals, fitted, alpha };
}

// === Logistic regression (Newton-Raphson IRLS) ===
export function logisticRegression(
  y: number[], X: number[][], predictorNames: string[], alpha = 0.05, maxIter = 50
): LogisticRegressionResult {
  const rows: number[][] = [];
  const yClean: number[] = [];
  for (let i = 0; i < y.length; i++) {
    if (y[i] !== 0 && y[i] !== 1) continue;
    if (X[i].some((v) => !isFinite(v))) continue;
    rows.push([1, ...X[i]]);
    yClean.push(y[i]);
  }
  const n = rows.length;
  const p = rows[0]?.length ?? 0;
  let beta = new Array(p).fill(0);
  let converged = false;
  let iter = 0;
  for (; iter < maxIter; iter++) {
    const probs = rows.map((row) => sigmoid(row.reduce((s, v, j) => s + v * beta[j], 0)));
    const W = probs.map((pi) => pi * (1 - pi));
    const z: number[] = rows.map((row, i) => {
      const eta = row.reduce((s, v, j) => s + v * beta[j], 0);
      return eta + (yClean[i] - probs[i]) / Math.max(W[i], 1e-9);
    });
    const Xt = transpose(rows);
    const WX = rows.map((row, i) => row.map((v) => v * W[i]));
    const XtWX = multiply(Xt, WX);
    const XtWz = Xt.map((rowT) => rowT.reduce((s, v, i) => s + v * W[i] * z[i], 0));
    let newBeta: number[];
    try {
      newBeta = multiplyVec(invert(XtWX), XtWz);
    } catch {
      break;
    }
    const diff = newBeta.reduce((s, v, j) => s + Math.abs(v - beta[j]), 0);
    beta = newBeta;
    if (diff < 1e-7) { converged = true; iter++; break; }
  }

  const probs = rows.map((row) => sigmoid(row.reduce((s, v, j) => s + v * beta[j], 0)));
  const logLik = yClean.reduce((s, yi, i) =>
    s + yi * Math.log(Math.max(probs[i], 1e-12)) + (1 - yi) * Math.log(Math.max(1 - probs[i], 1e-12)), 0);
  const yMean = yClean.reduce((s, v) => s + v, 0) / n;
  const logLikNull = yClean.reduce((s, yi) =>
    s + yi * Math.log(Math.max(yMean, 1e-12)) + (1 - yi) * Math.log(Math.max(1 - yMean, 1e-12)), 0);
  const pseudoR2 = 1 - logLik / logLikNull;

  // SE from inverse Fisher info
  const W = probs.map((pi) => pi * (1 - pi));
  const Xt = transpose(rows);
  const WX = rows.map((row, i) => row.map((v) => v * W[i]));
  let cov: number[][] = [];
  try { cov = invert(multiply(Xt, WX)); } catch { cov = []; }

  const zCrit = jStat.normal.inv(1 - alpha / 2, 0, 1);
  const names = ["(Intercept)", ...predictorNames];
  const coefficients = names.map((name, i) => {
    const se = cov.length ? Math.sqrt(Math.max(cov[i][i], 0)) : NaN;
    const z = beta[i] / se;
    const pv = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
    return {
      name, beta: beta[i], se, z, pValue: pv,
      oddsRatio: Math.exp(beta[i]),
      ciLower: Math.exp(beta[i] - zCrit * se),
      ciUpper: Math.exp(beta[i] + zCrit * se),
    };
  });

  let TP = 0, FP = 0, TN = 0, FN = 0;
  for (let i = 0; i < n; i++) {
    const pred = probs[i] >= 0.5 ? 1 : 0;
    if (yClean[i] === 1 && pred === 1) TP++;
    else if (yClean[i] === 0 && pred === 1) FP++;
    else if (yClean[i] === 0 && pred === 0) TN++;
    else FN++;
  }
  const accuracy = (TP + TN) / n;

  return { n, predictors: predictorNames, coefficients, pseudoR2, logLik, logLikNull,
    iterations: iter, converged, confusion: { TP, FP, TN, FN }, accuracy, alpha };
}

function sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)); }

// === Matrix utilities ===
function transpose(m: number[][]): number[][] {
  const r = m.length, c = m[0].length;
  const out: number[][] = Array.from({ length: c }, () => new Array(r));
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j][i] = m[i][j];
  return out;
}

function multiply(a: number[][], b: number[][]): number[][] {
  const ra = a.length, ca = a[0].length, cb = b[0].length;
  const out: number[][] = Array.from({ length: ra }, () => new Array(cb).fill(0));
  for (let i = 0; i < ra; i++) {
    for (let k = 0; k < ca; k++) {
      const aik = a[i][k];
      for (let j = 0; j < cb; j++) out[i][j] += aik * b[k][j];
    }
  }
  return out;
}

function multiplyVec(a: number[][], v: number[]): number[] {
  return a.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
}

function invert(m: number[][]): number[][] {
  const n = m.length;
  const aug: number[][] = m.map((row, i) => [...row, ...identityRow(n, i)]);
  for (let i = 0; i < n; i++) {
    let pivot = aug[i][i];
    if (Math.abs(pivot) < 1e-12) {
      let swap = -1;
      for (let r = i + 1; r < n; r++) if (Math.abs(aug[r][i]) > 1e-12) { swap = r; break; }
      if (swap === -1) throw new Error("Singular matrix");
      [aug[i], aug[swap]] = [aug[swap], aug[i]];
      pivot = aug[i][i];
    }
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = aug[r][i];
      for (let j = 0; j < 2 * n; j++) aug[r][j] -= factor * aug[i][j];
    }
  }
  return aug.map((row) => row.slice(n));
}

function identityRow(n: number, i: number): number[] {
  const out = new Array(n).fill(0);
  out[i] = 1;
  return out;
}
