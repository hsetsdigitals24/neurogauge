/* Client-side spreadsheet (Excel/ODS) parsing for uploaded datasets.
 *
 * Mirrors the output contract of parseCsv (./csvParser): every sheet is turned
 * into `{ headers, rows }` where rows are keyed by the original header text, so
 * the result feeds straight into sanitiseHeaders → remapRows → inferSchema just
 * like a parsed CSV. SheetJS is dynamically imported so the (heavy) library is
 * only pulled into the bundle when a user actually picks a spreadsheet — CSV
 * uploads are unaffected.
 */

/** File extensions handled by the spreadsheet parser (lower-case, with dot). */
export const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".ods"] as const;

/** True when the file looks like a spreadsheet we should parse with SheetJS. */
export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SPREADSHEET_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface WorkbookHandle {
  /** Sheet/tab names in workbook order. */
  sheetNames: string[];
  /** Parse a single sheet into the same shape parseCsv produces. */
  parseSheet(name: string): ParsedSheet;
}

/** Convert a single cell to a value compatible with the CSV pipeline. */
function normaliseCell(v: unknown): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10); // ISO date (YYYY-MM-DD)
  return v;
}

/**
 * Read a spreadsheet file into a handle that exposes its sheet names and lets
 * the caller parse a chosen sheet. The workbook is parsed once up front; each
 * `parseSheet` call only re-walks that one sheet's cells.
 */
export async function readWorkbook(file: File): Promise<WorkbookHandle> {
  const buf = await file.arrayBuffer();
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const sheetNames = wb.SheetNames.slice();

  function parseSheet(name: string): ParsedSheet {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error(`Sheet "${name}" not found in workbook.`);

    // Array-of-arrays so we control header handling exactly like parseCsv.
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      blankrows: false,
      defval: null,
    });
    if (matrix.length === 0) return { headers: [], rows: [] };

    const headerRow = matrix[0] ?? [];
    const headers = headerRow.map((h, i) => {
      const text = h == null ? "" : String(h).trim();
      return text || `Column_${i + 1}`;
    });

    const rows: Record<string, unknown>[] = [];
    for (let r = 1; r < matrix.length; r++) {
      const cells = matrix[r] ?? [];
      const row: Record<string, unknown> = {};
      for (let c = 0; c < headers.length; c++) {
        row[headers[c]] = normaliseCell(cells[c]);
      }
      rows.push(row);
    }
    return { headers, rows };
  }

  return { sheetNames, parseSheet };
}
