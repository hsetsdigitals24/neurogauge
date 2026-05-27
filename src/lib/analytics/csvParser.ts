export function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, unknown>[] } {
  const lines = splitLines(text.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseRow(lines[0]);
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseRow(lines[i]);
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const raw = cells[j] ?? "";
      const num = raw !== "" ? Number(raw) : NaN;
      row[headers[j]] = isNaN(num) ? raw : num;
    }
    rows.push(row);
  }

  return { headers, rows };
}

function splitLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
        current += ch;
      }
    } else if ((ch === "\n" || ch === "\r") && !inQuote) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function parseRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

export function rowsToCsv(
  rows: Record<string, unknown>[],
  columns: string[]
): string {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) =>
    columns.map((col) => csvEscape(row[col])).join(",")
  );
  return [header, ...body].join("\n");
}
