"use client";
import { useState, useMemo } from "react";
import { Loader2, Play } from "lucide-react";
import type { BackendAnalysisConfig, FieldDef } from "@/lib/analytics/backendConfig";
import type { ColumnSchema } from "@/lib/analytics/dataset";
import type { DialogKey } from "@/lib/stats/workspace";
import { useBackendRun } from "@/lib/analytics/useBackendRun";
import { BackendResultPanel } from "./BackendResultPanel";

interface Props {
  dialogKey: DialogKey;
  config: BackendAnalysisConfig;
  projectId: string;
  dataRows: Record<string, unknown>[];
  schema: Record<string, ColumnSchema>;
}

function colOptions(schema: Record<string, ColumnSchema>, filter: "numeric" | "categorical" | "any"): { id: string; label: string }[] {
  return Object.entries(schema)
    .filter(([, s]) => {
      if (filter === "any") return true;
      if (filter === "numeric") return s.type === "numeric";
      if (filter === "categorical") return s.type === "categorical" || s.type === "ordinal";
      return true;
    })
    .map(([id, s]) => ({ id, label: s.label || id }));
}

function initValues(fields: FieldDef[]): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "column-numeric" || f.type === "column-categorical" || f.type === "column-any") {
      v[f.id] = "";
    } else if (f.type === "column-numeric-multi" || f.type === "column-any-multi") {
      v[f.id] = [];
    } else if (f.type === "select") {
      v[f.id] = f.default;
    } else if (f.type === "radio") {
      v[f.id] = f.default;
    } else if (f.type === "number") {
      v[f.id] = f.default;
    } else if (f.type === "text") {
      v[f.id] = f.default;
    } else if (f.type === "textarea") {
      v[f.id] = f.default;
    }
  }
  return v;
}

function isReady(fields: FieldDef[], values: Record<string, unknown>): boolean {
  for (const f of fields) {
    if (!("required" in f)) continue;
    if (!f.required) continue;
    const v = values[f.id];
    if (f.type === "column-numeric-multi" || f.type === "column-any-multi") {
      if (!Array.isArray(v) || v.length === 0) return false;
    } else {
      if (!v) return false;
    }
  }
  return true;
}

export function BackendAnalysisForm({ dialogKey, config, projectId, dataRows, schema }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => initValues(config.fields));
  const { run, loading, error, result } = useBackendRun();

  function set(id: string, val: unknown) {
    setValues((prev) => ({ ...prev, [id]: val }));
  }

  function toggleMulti(id: string, col: string) {
    setValues((prev) => {
      const cur = (prev[id] as string[]) ?? [];
      return {
        ...prev,
        [id]: cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col],
      };
    });
  }

  async function handleRun() {
    const payload = config.toPayload(values);
    await run(config.endpoint, {
      projectId,
      variables: payload.variables,
      options: payload.options,
    });
  }

  const ready = useMemo(() => isReady(config.fields, values), [config.fields, values]);

  // Re-init when dialogKey changes (different analysis opened)
  const [lastKey, setLastKey] = useState(dialogKey);
  if (dialogKey !== lastKey) {
    setLastKey(dialogKey);
    setValues(initValues(config.fields));
  }

  return (
    <div className="space-y-4">
      {config.fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.id]}
          schema={schema}
          onChange={(v) => set(field.id, v)}
          onToggleMulti={(col) => toggleMulti(field.id, col)}
        />
      ))}

      <div className="flex items-center gap-2 pt-1">
        <button
          className="btn btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
          disabled={!ready || loading || dataRows.length === 0}
          onClick={handleRun}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {loading ? "Running…" : "Run"}
        </button>
        {dataRows.length === 0 && (
          <span className="text-xs text-[color:var(--muted)]">No data rows — apply a filter or load data first.</span>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-xs text-red-700 border border-red-100">
          {error}
        </div>
      )}

      {result && <BackendResultPanel result={result} />}
    </div>
  );
}

// ─── Field renderers ────────────────────────────────────────────────────────

interface FieldInputProps {
  field: FieldDef;
  value: unknown;
  schema: Record<string, ColumnSchema>;
  onChange: (v: unknown) => void;
  onToggleMulti: (col: string) => void;
}

function FieldInput({ field, value, schema, onChange, onToggleMulti }: FieldInputProps) {
  const label = (
    <span className="label text-xs">
      {field.label}
      {"required" in field && field.required && <span className="text-red-500 ml-0.5">*</span>}
    </span>
  );

  if (field.type === "column-numeric") {
    const opts = colOptions(schema, "numeric");
    return (
      <label className="block">
        {label}
        <select className="select text-xs" value={value as string} onChange={(e) => onChange(e.target.value)}>
          <option value="">— select —</option>
          {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
    );
  }

  if (field.type === "column-categorical") {
    const opts = colOptions(schema, "categorical");
    return (
      <label className="block">
        {label}
        <select className="select text-xs" value={value as string} onChange={(e) => onChange(e.target.value)}>
          <option value="">— none —</option>
          {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
    );
  }

  if (field.type === "column-any") {
    const opts = colOptions(schema, "any");
    return (
      <label className="block">
        {label}
        <select className="select text-xs" value={value as string} onChange={(e) => onChange(e.target.value)}>
          <option value="">— select —</option>
          {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
    );
  }

  if (field.type === "column-numeric-multi") {
    const opts = colOptions(schema, "numeric");
    const selected = (value as string[]) ?? [];
    return (
      <div>
        {label}
        <div className="mt-1 border border-[color:var(--border)] rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
          {opts.length === 0 && <p className="text-xs text-[color:var(--muted)]">No numeric columns available.</p>}
          {opts.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => onToggleMulti(o.id)}
              />
              {o.label}
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <p className="text-[10px] text-[color:var(--muted)] mt-0.5">{selected.length} selected</p>
        )}
      </div>
    );
  }

  if (field.type === "column-any-multi") {
    const opts = colOptions(schema, "any");
    const selected = (value as string[]) ?? [];
    return (
      <div>
        {label}
        <div className="mt-1 border border-[color:var(--border)] rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
          {opts.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => onToggleMulti(o.id)}
              />
              {o.label}
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <p className="text-[10px] text-[color:var(--muted)] mt-0.5">{selected.length} selected</p>
        )}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <label className="block">
        {label}
        <select className="select text-xs" value={value as string} onChange={(e) => onChange(e.target.value)}>
          {field.choices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    );
  }

  if (field.type === "radio") {
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-2 mt-1">
          {field.choices.map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={v}
                checked={value === v}
                onChange={() => onChange(v)}
              />
              {l}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <label className="block">
        {label}
        <input
          type="number"
          className="input text-xs"
          value={value as number}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
      </label>
    );
  }

  if (field.type === "text") {
    return (
      <label className="block">
        {label}
        <input
          type="text"
          className="input text-xs"
          value={value as string}
          placeholder={"placeholder" in field ? field.placeholder : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block">
        {label}
        <textarea
          className="input text-xs font-mono resize-y"
          rows={field.rows ?? 5}
          value={value as string}
          placeholder={"placeholder" in field ? field.placeholder : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  return null;
}
