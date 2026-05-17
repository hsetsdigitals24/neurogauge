import { FilterExpr, VariableDef } from "./workspace";
import { compare } from "./transforms";

/**
 * Returns the set of participantIds that pass the filter.
 * Empty filter → all pids (returns null meaning "no filter").
 */
export function filterPids(
  filter: FilterExpr,
  resolveAny: (variableId: string) => Map<string, number | string | null>,
  variables: VariableDef[],
): Set<string> | null {
  if (!filter.clauses.length) return null;
  let current: Set<string> | null = null;
  for (const clause of filter.clauses) {
    const varDef = variables.find((v) => v.id === clause.variableId);
    if (!varDef) continue;
    const data = resolveAny(clause.variableId);
    const pass = new Set<string>();
    for (const [pid, val] of data) {
      if (val == null) continue;
      if (compare(val, clause.op, clause.value)) pass.add(pid);
    }
    current = current === null ? pass : intersect(current, pass);
  }
  return current;
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const v of a) if (b.has(v)) out.add(v);
  return out;
}
