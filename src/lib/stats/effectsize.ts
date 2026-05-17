export interface EffectSize {
  name: string;
  value: number;
  interpretation: string;
}

export function cohenD(a: number[], b: number[]): EffectSize {
  const A = a.filter(isFinite);
  const B = b.filter(isFinite);
  const ma = A.reduce((s, v) => s + v, 0) / A.length;
  const mb = B.reduce((s, v) => s + v, 0) / B.length;
  const va = A.reduce((s, v) => s + (v - ma) ** 2, 0) / (A.length - 1);
  const vb = B.reduce((s, v) => s + (v - mb) ** 2, 0) / (B.length - 1);
  const sp = Math.sqrt(((A.length - 1) * va + (B.length - 1) * vb) / (A.length + B.length - 2));
  const d = (ma - mb) / sp;
  return { name: "Cohen's d", value: d, interpretation: interpretD(Math.abs(d)) };
}

function interpretD(absD: number): string {
  if (absD < 0.2) return "negligible";
  if (absD < 0.5) return "small";
  if (absD < 0.8) return "medium";
  return "large";
}

export function etaSquared(ssBetween: number, ssTotal: number): EffectSize {
  const eta2 = ssBetween / ssTotal;
  return { name: "η²", value: eta2, interpretation: interpretEta2(eta2) };
}

function interpretEta2(eta2: number): string {
  if (eta2 < 0.01) return "negligible";
  if (eta2 < 0.06) return "small";
  if (eta2 < 0.14) return "medium";
  return "large";
}

/** Odds ratio from a 2x2 contingency table [[a,b],[c,d]] with optional 0.5 continuity correction. */
export function oddsRatio(table: [[number, number], [number, number]]): EffectSize {
  let [[a, b], [c, d]] = table;
  if (a === 0 || b === 0 || c === 0 || d === 0) {
    a += 0.5; b += 0.5; c += 0.5; d += 0.5;
  }
  const or = (a * d) / (b * c);
  return { name: "Odds ratio", value: or, interpretation: interpretOR(or) };
}

function interpretOR(or: number): string {
  if (or > 1 / 1.5 && or < 1.5) return "negligible";
  if (or > 1 / 3 && or < 3) return "small/medium";
  return "large";
}
