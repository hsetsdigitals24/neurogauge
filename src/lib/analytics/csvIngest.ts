/* Server-side CSV ingestion helpers for uploaded datasets.
 *
 * Turns a raw parsed CSV into a stored Dataset's `rows` + `schema`:
 *  - sanitiseHeaders: makes column names safe to use as keys AND safe for the
 *    analytics service's formula tokeniser (referencedColumns in dataset.ts
 *    splits formula/model strings on non-word chars; spaces/punctuation in a
 *    raw header would be shredded — same class of bug as the historical
 *    custom_<uuid> hyphen issue). The original header text is kept as `label`.
 *  - inferSchema: numeric vs categorical from the data, overridable later by
 *    the user in the Variable View.
 */

import type { ColumnSchema } from "./dataset";

export interface HeaderMapping {
  /** Sanitised, safe-to-tokenise column key used in rows + schema. */
  key: string;
  /** Original header text, shown to the user as the column label. */
  label: string;
}

/**
 * Sanitise a single label into a safe column key (tokeniser-friendly, no
 * uniqueness applied). Collapses non-word runs to "_", trims "_", and ensures
 * it doesn't start with a digit.
 */
export function sanitiseColumnKey(label: string, fallback = "col"): string {
  let key = (label ?? "").trim().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
  if (!key) return fallback;
  if (/^\d/.test(key)) key = `col_${key}`;
  return key;
}

/** Append _2, _3, … until `base` is not in `existing`. */
export function uniqueKey(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

/**
 * Sanitise raw CSV headers into safe, unique column keys.
 * De-duplicates by appending _2, _3, … The original header text is kept as
 * `label`.
 */
export function sanitiseHeaders(headers: string[]): HeaderMapping[] {
  const used = new Set<string>();
  return headers.map((raw, i) => {
    const label = (raw ?? "").trim() || `Column ${i + 1}`;
    const base = sanitiseColumnKey(label, `col_${i + 1}`);
    const key = uniqueKey(base, used);
    used.add(key);
    return { key, label };
  });
}

/** True when every non-empty value in the column parses as a finite number. */
function isNumericColumn(rows: Record<string, unknown>[], key: string): boolean {
  let sawValue = false;
  for (const row of rows) {
    const v = row[key];
    if (v == null || v === "") continue;
    sawValue = true;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return false;
  }
  return sawValue; // an all-empty column is treated as categorical
}

/**
 * Infer a ColumnSchema for each sanitised column. Numeric if all non-empty
 * values are finite numbers; otherwise categorical. Users can override the
 * type later in the Variable View.
 */
export function inferSchema(
  rows: Record<string, unknown>[],
  columns: HeaderMapping[]
): Record<string, ColumnSchema> {
  const schema: Record<string, ColumnSchema> = {};
  for (const { key, label } of columns) {
    schema[key] = {
      type: isNumericColumn(rows, key) ? "numeric" : "categorical",
      label,
    };
  }
  return schema;
}

/**
 * Re-key parsed rows (which use the original headers) onto sanitised keys,
 * coercing numeric-looking cells to numbers and empty cells to null.
 */
export function remapRows(
  rows: Record<string, unknown>[],
  columns: HeaderMapping[],
  originalHeaders: string[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      const orig = originalHeaders[i];
      const v = row[orig];
      if (v == null || v === "") {
        out[columns[i].key] = null;
      } else {
        const n = typeof v === "number" ? v : Number(v);
        out[columns[i].key] = Number.isFinite(n) && String(v).trim() !== "" ? n : v;
      }
    }
    return out;
  });
}
