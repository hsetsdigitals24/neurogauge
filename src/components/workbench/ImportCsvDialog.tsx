"use client";
import { useRef, useState } from "react";
import { Upload, X, Check, AlertTriangle } from "lucide-react";
import { parseCsv } from "@/lib/analytics/csvParser";
import { isSpreadsheetFile, readWorkbook, type WorkbookHandle } from "@/lib/analytics/spreadsheetParser";
import { useWorkbench } from "@/contexts/WorkbenchContext";

const IMPORT_ACCEPT =
  ".csv,.xlsx,.xls,.xlsm,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

interface Props {
  onClose: () => void;
}

interface ParseResult {
  headers: string[];
  rows: Record<string, unknown>[];
  warnings: string[];
}

export function ImportCsvDialog({ onClose }: Props) {
  const { state, dispatch } = useWorkbench();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookHandle | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  /** Build the preview ParseResult (incl. schema-match warnings) from parsed cells. */
  function toParseResult(headers: string[], rows: Record<string, unknown>[]): ParseResult {
    const warnings: string[] = [];
    const schemaKeys = Object.keys(state.schema);
    const unknown = headers.filter((h) => !schemaKeys.includes(h));
    const matched = headers.filter((h) => schemaKeys.includes(h));
    if (matched.length === 0) {
      warnings.push("No columns match the existing schema. Rows will be appended with custom columns only.");
    }
    if (unknown.length > 0) {
      warnings.push(`${unknown.length} unrecognised column(s): ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}`);
    }
    return { headers, rows, warnings };
  }

  function resetState(name: string) {
    setError(null);
    setParsed(null);
    setWorkbook(null);
    setSelectedSheet("");
    setFileName(name);
  }

  function handleFile(file: File) {
    resetState(file.name);
    if (isSpreadsheetFile(file)) {
      readWorkbook(file)
        .then((wb) => {
          if (wb.sheetNames.length === 0) { setError("Workbook has no sheets."); return; }
          setWorkbook(wb);
          selectSheet(wb, wb.sheetNames[0]);
        })
        .catch((e) => setError(`Could not read spreadsheet: ${e instanceof Error ? e.message : String(e)}`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { headers, rows } = parseCsv(reader.result as string);
        if (headers.length === 0) { setError("File appears empty or has no header row."); return; }
        setParsed(toParseResult(headers, rows));
      } catch (e) {
        setError(`Could not parse CSV: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    reader.readAsText(file);
  }

  function selectSheet(wb: WorkbookHandle, name: string) {
    setSelectedSheet(name);
    try {
      const { headers, rows } = wb.parseSheet(name);
      if (headers.length === 0) { setError(`Sheet "${name}" appears empty or has no header row.`); setParsed(null); return; }
      setError(null);
      setParsed(toParseResult(headers, rows));
    } catch (e) {
      setError(`Could not parse sheet: ${e instanceof Error ? e.message : String(e)}`);
      setParsed(null);
    }
  }

  function handleMerge() {
    if (!parsed) return;
    dispatch({ type: "mergeImport", rows: parsed.rows });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
          <h2 className="font-bold text-base">Import data</h2>
          <button className="btn btn-ghost p-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-[color:var(--border)] rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-[color:var(--muted)]" />
            <p className="text-sm font-medium">{fileName || "Click or drag a CSV or Excel file here"}</p>
            <p className="text-xs text-[color:var(--muted)] mt-1">CSV (UTF-8, RFC-4180) or Excel/ODS spreadsheet</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          {/* Sheet selector (multi-tab workbooks) */}
          {workbook && workbook.sheetNames.length > 1 && (
            <div>
              <label className="text-xs font-semibold text-[color:var(--muted)] block mb-1">Sheet</label>
              <select
                className="w-full text-sm rounded-lg border border-[color:var(--border)] px-3 py-2 bg-white"
                value={selectedSheet}
                onChange={(e) => selectSheet(workbook, e.target.value)}
              >
                {workbook.sheetNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-100">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Warnings */}
          {parsed?.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-xs text-amber-700 border border-amber-100">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}

          {/* Preview table */}
          {parsed && (
            <div>
              <p className="text-xs font-semibold mb-2 text-[color:var(--muted)]">
                Preview — {parsed.rows.length.toLocaleString()} rows × {parsed.headers.length} columns
              </p>
              <div className="overflow-x-auto rounded-lg border border-[color:var(--border)]">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[color:var(--border)]">
                      {parsed.headers.slice(0, 8).map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                          {h}
                          {h in state.schema && (
                            <Check className="w-3 h-3 inline-block ml-1 text-green-500" />
                          )}
                        </th>
                      ))}
                      {parsed.headers.length > 8 && (
                        <th className="px-2 py-1.5 text-[color:var(--muted)]">+{parsed.headers.length - 8} more</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-[color:var(--border)] last:border-0 hover:bg-gray-50">
                        {parsed.headers.slice(0, 8).map((h) => (
                          <td key={h} className="px-2 py-1 truncate max-w-[100px]" title={String(row[h] ?? "")}>
                            {String(row[h] ?? "")}
                          </td>
                        ))}
                        {parsed.headers.length > 8 && <td className="px-2 py-1 text-[color:var(--muted)]">…</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[color:var(--border)]">
          <button className="btn btn-ghost text-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary text-sm disabled:opacity-50"
            disabled={!parsed || !!error}
            onClick={handleMerge}
          >
            Merge {parsed ? `(${parsed.rows.length.toLocaleString()} rows)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
