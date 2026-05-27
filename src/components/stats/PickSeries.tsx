"use client";
import { Variable } from "@/lib/stats";
import { useWorkspace } from "./workspace/WorkspaceProvider";

/**
 * Picker fed by workspace.variables — emits a ref-typed Variable.
 * `allowCategorical` includes nominal variables; default lists numeric + ordinal.
 */
export function VariablePicker({
  value, onChange, label, allowCategorical = false,
}: {
  // catalog kept for backwards compat with existing card signatures; ignored
  catalog?: unknown;
  value: Variable | null;
  onChange: (v: Variable) => void;
  label: string;
  allowCategorical?: boolean;
}) {
  const ws = useWorkspace();
  const options = ws.variables.filter((v) => allowCategorical ? true : v.role !== "nominal");
  const currentId = value?.kind === "ref" ? value.id : "";
  return (
    <label className="block">
      <span className="label text-xs">{label}</span>
      <select
        className="select"
        value={currentId}
        onChange={(e) => onChange({ kind: "ref", id: e.target.value })}
      >
        <option value="" disabled>Select a variable…</option>
        {options.map((v) => (
          <option key={v.id} value={v.id}>{v.label}</option>
        ))}
      </select>
    </label>
  );
}

export function CategoricalPicker({
  value, onChange, label,
}: {
  catalog?: unknown;
  value: Variable | null;
  onChange: (v: Variable) => void;
  label: string;
}) {
  const ws = useWorkspace();
  const options = ws.variables.filter((v) => v.role === "nominal" || v.role === "ordinal");
  const currentId = value?.kind === "ref" ? value.id : "";
  return (
    <label className="block">
      <span className="label text-xs">{label}</span>
      <select className="select" value={currentId}
        onChange={(e) => onChange({ kind: "ref", id: e.target.value })}>
        <option value="" disabled>Select a grouping…</option>
        {options.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
    </label>
  );
}

export function varKey(v: Variable): string {
  if (v.kind === "ref") return v.id;
  if (v.kind === "block-metric") return `bm.${v.metric}.${v.stimulusType ?? "all"}.${v.level ?? "all"}`;
  if (v.kind === "tlx") return `tlx.${v.scope}.${v.dim}${v.level != null ? `.${v.level}` : ""}`;
  if (v.kind === "demographic") return `demo.${v.field}`;
  if (v.kind === "custom") return `cust.${v.questionId}`;
  return "";
}
