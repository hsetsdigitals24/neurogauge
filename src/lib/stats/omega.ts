export interface OmegaResult {
  k: number;
  n: number;
  loadings: { name: string; lambda: number; uniqueness: number }[];
  omega: number;
  notes: string;
}

/**
 * McDonald's ω based on a one-factor model whose loadings are approximated by
 * the first principal component of the standardized item matrix.
 *
 * Note: This is an approximation. A proper ω requires CFA via ML; for many
 * applied datasets the PCA-based loadings are very close to the CFA solution.
 * Reported with a "notes" caveat so researchers know what they got.
 */
export function mcDonaldOmega(matrix: number[][], itemNames?: string[]): OmegaResult {
  const rows = matrix.filter((r) => r.every(isFinite));
  const n = rows.length;
  const k = rows[0]?.length ?? 0;
  if (n < 3 || k < 2) {
    return { k, n, loadings: [], omega: NaN, notes: "Need ≥3 cases and ≥2 items." };
  }
  // Standardize columns
  const means = new Array(k).fill(0);
  const sds = new Array(k).fill(0);
  for (let j = 0; j < k; j++) {
    const col = rows.map((r) => r[j]);
    means[j] = col.reduce((s, v) => s + v, 0) / n;
    sds[j] = Math.sqrt(col.reduce((s, v) => s + (v - means[j]) ** 2, 0) / (n - 1));
  }
  const Z = rows.map((r) => r.map((v, j) => sds[j] > 0 ? (v - means[j]) / sds[j] : 0));

  // Correlation matrix R = Z'Z / (n-1)
  const R: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      let s = 0;
      for (let r = 0; r < n; r++) s += Z[r][i] * Z[r][j];
      R[i][j] = s / (n - 1);
    }
  }
  // First eigenvector by power iteration
  let v = new Array(k).fill(1 / Math.sqrt(k));
  let lambdaMax = 0;
  for (let it = 0; it < 200; it++) {
    const Rv = new Array(k).fill(0);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) Rv[i] += R[i][j] * v[j];
    const norm = Math.sqrt(Rv.reduce((s, x) => s + x * x, 0)) || 1;
    const next = Rv.map((x) => x / norm);
    const lam = Rv.reduce((s, x, i) => s + x * next[i], 0);
    const diff = next.reduce((s, x, i) => s + Math.abs(x - v[i]), 0);
    v = next; lambdaMax = lam;
    if (diff < 1e-9) break;
  }
  // Loadings: λ_i = sign-corrected eigenvector × sqrt(eigenvalue)
  const sign = v.reduce((s, x) => s + x, 0) >= 0 ? 1 : -1;
  const loadings = v.map((vi) => sign * vi * Math.sqrt(Math.max(0, lambdaMax)));
  const sumLambda = loadings.reduce((s, l) => s + l, 0);
  const sumUniq = loadings.reduce((s, l) => s + (1 - l * l), 0);
  const omega = (sumLambda * sumLambda) / (sumLambda * sumLambda + sumUniq);

  return {
    k, n,
    loadings: loadings.map((l, i) => ({
      name: itemNames?.[i] ?? `Item ${i + 1}`,
      lambda: l, uniqueness: 1 - l * l,
    })),
    omega,
    notes: "ω derived from first principal component (PCA approximation, not full CFA-ML).",
  };
}
