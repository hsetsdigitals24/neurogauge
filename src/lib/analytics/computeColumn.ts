/* Row-level computed columns for uploaded datasets.
 *
 * Mirrors the op vocabulary of the legacy, participant-keyed transform engine
 * ([src/lib/stats/transforms.ts]) but evaluates over plain dataset rows keyed by
 * column name. Computed values are materialised into the rows as ordinary
 * columns, so the proxy / Python service need no special handling.
 */

import { compare } from "@/lib/stats/transforms";
import type { ColumnType } from "./dataset";

export interface Band {
  from: number;
  to: number;
  label: string;
}

export type CompareOp = "==" | "!=" | "<" | "<=" | ">" | ">=";

export type ComputedSpec =
  | { op: "mean"; inputs: string[] }
  | { op: "sum"; inputs: string[] }
  | { op: "diff"; a: string; b: string }
  | { op: "zscore"; input: string }
  | { op: "log"; input: string; offset: number }
  | { op: "recode"; input: string; bins: Band[] }
  | {
      op: "ifThen";
      conditionCol: string;
      compareOp: CompareOp;
      value: number | string;
      thenValue: number | string;
      elseValue: number | string;
    };

export interface ComputedColumnDef {
  /** Sanitised column key written into each row + schema. */
  key: string;
  label: string;
  type: ColumnType;
  spec: ComputedSpec;
}

/** Column names a computed-column definition reads from (its inputs). */
export function computedInputColumns(def: ComputedColumnDef): string[] {
  const t = def.spec;
  switch (t.op) {
    case "mean":
    case "sum":
      return [...t.inputs];
    case "diff":
      return [t.a, t.b];
    case "zscore":
    case "log":
    case "recode":
      return [t.input];
    case "ifThen":
      return [t.conditionCol];
  }
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Materialise any computed columns missing from the rows (mutating copies, not
 * the input). Blob-backed datasets don't persist materialised rows, so their
 * computed columns are re-applied from the stored definitions on every load —
 * both client-side (workbench) and server-side (analytics proxy).
 */
export function applyComputedColumns(
  rows: Record<string, unknown>[],
  defs: ComputedColumnDef[]
): Record<string, unknown>[] {
  const missing = defs.filter((d) => rows.length > 0 && !(d.key in rows[0]));
  if (missing.length === 0) return rows;
  let out = rows.map((r) => ({ ...r }));
  for (const def of missing) {
    const values = computeColumnForRows(out, def);
    out = out.map((r, i) => ({ ...r, [def.key]: values[i] }));
  }
  return out;
}

/** Compute one value per row for a computed-column definition. */
export function computeColumnForRows(
  rows: Record<string, unknown>[],
  def: ComputedColumnDef
): unknown[] {
  const t = def.spec;

  switch (t.op) {
    case "mean":
    case "sum":
      return rows.map((r) => {
        const vals = t.inputs.map((c) => num(r[c])).filter((v): v is number => v != null);
        if (vals.length === 0) return null;
        const total = vals.reduce((s, v) => s + v, 0);
        return t.op === "mean" ? total / vals.length : total;
      });

    case "diff":
      return rows.map((r) => {
        const a = num(r[t.a]);
        const b = num(r[t.b]);
        return a == null || b == null ? null : a - b;
      });

    case "zscore": {
      const vals = rows.map((r) => num(r[t.input]));
      const present = vals.filter((v): v is number => v != null);
      const mean = present.reduce((s, v) => s + v, 0) / Math.max(1, present.length);
      const sd = Math.sqrt(
        present.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, present.length - 1)
      );
      return vals.map((v) => (v == null || sd === 0 ? null : (v - mean) / sd));
    }

    case "log":
      return rows.map((r) => {
        const v = num(r[t.input]);
        if (v == null) return null;
        const x = v + (t.offset ?? 0);
        return x > 0 ? Math.log(x) : null;
      });

    case "recode":
      return rows.map((r) => {
        const v = num(r[t.input]);
        if (v == null) return null;
        const band = t.bins.find((b) => v >= b.from && v <= b.to);
        return band ? band.label : null;
      });

    case "ifThen":
      return rows.map((r) => {
        const raw = r[t.conditionCol];
        if (raw == null || raw === "") return null;
        const left = typeof raw === "number" ? raw : String(raw);
        const match = compare(left, t.compareOp, t.value);
        return match ? t.thenValue : t.elseValue;
      });
  }
}
