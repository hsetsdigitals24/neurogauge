import { Transform, VariableDef, FilterOp } from "./workspace";

export type Resolver = (variableId: string) => Map<string, number | null>;

/**
 * Compute a derived variable's values per participantId, given a resolver
 * that returns a participantId → numeric-value map for any variable id it
 * depends on.
 */
export function computeDerived(
  def: VariableDef, resolveNumeric: Resolver, resolveCategoricalOrNumeric: (id: string) => Map<string, number | string | null>
): Map<string, number | null> {
  if (def.source.kind !== "derived") return resolveNumeric(def.id);
  const t = def.source.transform;
  const out = new Map<string, number | null>();

  switch (t.op) {
    case "mean":
    case "sum": {
      const inputs = t.inputIds.map((id) => resolveNumeric(id));
      const pids = unionKeys(inputs);
      for (const pid of pids) {
        const vals = inputs.map((m) => m.get(pid)).filter((v): v is number => v != null && isFinite(v));
        if (vals.length === 0) { out.set(pid, null); continue; }
        const agg = t.op === "mean" ? vals.reduce((s, v) => s + v, 0) / vals.length : vals.reduce((s, v) => s + v, 0);
        out.set(pid, agg);
      }
      return out;
    }
    case "diff": {
      const a = resolveNumeric(t.aId), b = resolveNumeric(t.bId);
      for (const pid of unionKeys([a, b])) {
        const av = a.get(pid), bv = b.get(pid);
        if (av == null || bv == null || !isFinite(av) || !isFinite(bv)) out.set(pid, null);
        else out.set(pid, av - bv);
      }
      return out;
    }
    case "zscore": {
      const m = resolveNumeric(t.inputId);
      const vals = [...m.values()].filter((v): v is number => v != null && isFinite(v));
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length - 1));
      for (const [pid, v] of m) {
        if (v == null || !isFinite(v) || sd === 0) out.set(pid, null);
        else out.set(pid, (v - mean) / sd);
      }
      return out;
    }
    case "log": {
      const m = resolveNumeric(t.inputId);
      const offset = t.offset ?? 0;
      for (const [pid, v] of m) {
        if (v == null || !isFinite(v) || v + offset <= 0) out.set(pid, null);
        else out.set(pid, Math.log(v + offset));
      }
      return out;
    }
    case "recode": {
      const m = resolveNumeric(t.inputId);
      for (const [pid, v] of m) {
        if (v == null || !isFinite(v)) { out.set(pid, null); continue; }
        const bin = t.bins.findIndex((b) => v >= b.from && v <= b.to);
        out.set(pid, bin >= 0 ? bin : null);
      }
      return out;
    }
    case "ifThen": {
      const m = resolveCategoricalOrNumeric(t.conditionVarId);
      for (const [pid, raw] of m) {
        if (raw == null) { out.set(pid, null); continue; }
        const match = compare(raw, t.compareOp, t.value);
        const result = match ? t.thenValue : t.elseValue;
        const n = typeof result === "number" ? result : parseFloat(String(result));
        out.set(pid, isFinite(n) ? n : null);
      }
      return out;
    }
  }
}

export function compare(left: number | string, op: FilterOp, right: number | string | string[]): boolean {
  if (op === "in") {
    const arr = Array.isArray(right) ? right.map(String) : [String(right)];
    return arr.includes(String(left));
  }
  const lNum = typeof left === "number" ? left : parseFloat(String(left));
  const rNum = typeof right === "number" ? right : parseFloat(String(right));
  const numericMode = isFinite(lNum) && isFinite(rNum) && !Array.isArray(right);
  switch (op) {
    case "==": return numericMode ? lNum === rNum : String(left) === String(right);
    case "!=": return numericMode ? lNum !== rNum : String(left) !== String(right);
    case "<":  return numericMode ? lNum < rNum : String(left) < String(right);
    case "<=": return numericMode ? lNum <= rNum : String(left) <= String(right);
    case ">":  return numericMode ? lNum > rNum : String(left) > String(right);
    case ">=": return numericMode ? lNum >= rNum : String(left) >= String(right);
  }
  return false;
}

function unionKeys(maps: Map<string, unknown>[]): Set<string> {
  const out = new Set<string>();
  for (const m of maps) for (const k of m.keys()) out.add(k);
  return out;
}

export function transformLabel(t: Transform, labelOf: (id: string) => string): string {
  switch (t.op) {
    case "mean": return `Mean(${t.inputIds.map(labelOf).join(", ")})`;
    case "sum":  return `Sum(${t.inputIds.map(labelOf).join(", ")})`;
    case "diff": return `${labelOf(t.aId)} − ${labelOf(t.bId)}`;
    case "zscore": return `z(${labelOf(t.inputId)})`;
    case "log": return `log(${labelOf(t.inputId)}${t.offset ? ` + ${t.offset}` : ""})`;
    case "recode": return `recode(${labelOf(t.inputId)})`;
    case "ifThen": return `if ${labelOf(t.conditionVarId)} ${t.compareOp} ${t.value} then ${t.thenValue} else ${t.elseValue}`;
  }
}
