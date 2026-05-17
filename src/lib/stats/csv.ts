export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function esc(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = typeof v === "number" ? (isFinite(v) ? String(v) : "") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
