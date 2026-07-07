// Independent d′/criterion implementation for cross-checking src/lib/scoring.ts.
// Deliberately uses a DIFFERENT inverse-normal approximation (Abramowitz & Stegun
// 26.2.23, |error| < 4.5e-4) than the app's Acklam implementation, so agreement
// within tolerance is a genuine cross-check rather than the same code twice.

function inverseNormalAS(p: number): number {
  // A&S 26.2.23 rational approximation for the lower tail
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];
  const lower = p < 0.5;
  const pp = lower ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(pp));
  const num = c[0] + c[1] * t + c[2] * t * t;
  const den = 1 + d[0] * t + d[1] * t * t + d[2] * t * t * t;
  const x = t - num / den;
  return lower ? -x : x;
}

// Mirrors the app's clamping policy (p limited to [0.01, 0.99]) — that policy is
// itself part of what we verify (finite d′ at perfect performance).
export function zClamped(p: number): number {
  return inverseNormalAS(Math.min(Math.max(p, 0.01), 0.99));
}

export function expectedMetrics(counts: {
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
  hitRts: number[];
}) {
  const { hits, misses, falseAlarms, correctRejections, hitRts } = counts;
  const targets = hits + misses;
  const nontargets = falseAlarms + correctRejections;
  const hitRate = targets ? hits / targets : 0;
  const faRate = nontargets ? falseAlarms / nontargets : 0;
  const dPrime = zClamped(hitRate) - zClamped(faRate);
  const criterion = -0.5 * (zClamped(hitRate) + zClamped(faRate));
  const scorable = targets + nontargets;
  const accuracy = scorable ? (hits + correctRejections) / scorable : 0;
  const rtMean = hitRts.length ? hitRts.reduce((a, b) => a + b, 0) / hitRts.length : null;
  const sorted = [...hitRts].sort((a, b) => a - b);
  const rtMedian = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const rtSD =
    hitRts.length > 1
      ? Math.sqrt(
          hitRts.reduce((s, v) => s + (v - (rtMean as number)) ** 2, 0) /
            (hitRts.length - 1)
        )
      : null;
  return { hitRate, faRate, dPrime, criterion, accuracy, rtMean, rtMedian, rtSD };
}

// Two different Φ⁻¹ approximations: Acklam ~1e-9, A&S ~4.5e-4 per call;
// d′/criterion combine two calls, so 2e-3 comfortably covers approximation skew.
export const DPRIME_TOLERANCE = 2e-3;
