export function fmt(v: number | null | undefined, digits = 3): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-3 && v !== 0)) return v.toExponential(2);
  return v.toFixed(digits);
}

export function fmtP(p: number | null | undefined): string {
  if (p == null || !isFinite(p)) return "—";
  if (p < 0.0001) return "< .0001";
  if (p < 0.001) return "< .001";
  return p.toFixed(3).replace(/^0/, "");
}

export function pStars(p: number): string {
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "";
}
