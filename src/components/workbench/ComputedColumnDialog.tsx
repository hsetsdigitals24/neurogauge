"use client";
import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useWorkbench } from "@/contexts/WorkbenchContext";
import { sanitiseColumnKey, uniqueKey } from "@/lib/analytics/csvIngest";
import type { ColumnType } from "@/lib/analytics/dataset";
import type { Band, CompareOp, ComputedSpec, ComputedColumnDef } from "@/lib/analytics/computeColumn";

type Op = ComputedSpec["op"];

const OP_LABELS: Record<Op, string> = {
  mean: "Mean of columns",
  sum: "Sum of columns",
  diff: "A − B (difference)",
  zscore: "Standardise (z-score)",
  log: "Log transform",
  recode: "Recode numeric into bands",
  ifThen: "If-then",
};

export function ComputedColumnDialog({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useWorkbench();
  const numericCols = Object.keys(state.schema).filter((c) => state.schema[c].type === "numeric");
  const allCols = Object.keys(state.schema);
  const colLabel = (c: string) => state.schema[c]?.label || c;

  const [op, setOp] = useState<Op>("mean");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ColumnType>("numeric");
  const [inputs, setInputs] = useState<string[]>([numericCols[0] ?? "", numericCols[1] ?? ""]);
  const [aCol, setACol] = useState(numericCols[0] ?? "");
  const [bCol, setBCol] = useState(numericCols[1] ?? "");
  const [offset, setOffset] = useState<number>(1);
  const [bins, setBins] = useState<Band[]>([
    { from: 0, to: 33, label: "low" },
    { from: 34, to: 66, label: "mid" },
    { from: 67, to: 100, label: "high" },
  ]);
  const [conditionCol, setConditionCol] = useState(allCols[0] ?? "");
  const [compareOp, setCompareOp] = useState<CompareOp>(">");
  const [conditionValue, setConditionValue] = useState<string>("0");
  const [thenValue, setThenValue] = useState<string>("1");
  const [elseValue, setElseValue] = useState<string>("0");
  const [error, setError] = useState<string | null>(null);

  function buildSpec(): ComputedSpec | null {
    if (op === "mean" || op === "sum") {
      const clean = inputs.filter(Boolean);
      if (clean.length < 2) { setError("Pick at least two columns."); return null; }
      return { op, inputs: clean };
    }
    if (op === "diff") {
      if (!aCol || !bCol) { setError("Pick both A and B."); return null; }
      return { op: "diff", a: aCol, b: bCol };
    }
    if (op === "zscore") {
      if (!aCol) { setError("Pick a column."); return null; }
      return { op: "zscore", input: aCol };
    }
    if (op === "log") {
      if (!aCol) { setError("Pick a column."); return null; }
      return { op: "log", input: aCol, offset };
    }
    if (op === "recode") {
      if (!aCol || bins.length === 0) { setError("Pick a column and at least one band."); return null; }
      return { op: "recode", input: aCol, bins };
    }
    // ifThen
    if (!conditionCol) { setError("Pick a condition column."); return null; }
    const cv = parseFloat(conditionValue);
    const tv = parseFloat(thenValue);
    const ev = parseFloat(elseValue);
    return {
      op: "ifThen",
      conditionCol,
      compareOp,
      value: isFinite(cv) ? cv : conditionValue,
      thenValue: isFinite(tv) ? tv : thenValue,
      elseValue: isFinite(ev) ? ev : elseValue,
    };
  }

  function save() {
    setError(null);
    if (!label.trim()) { setError("Give the column a name."); return; }
    const spec = buildSpec();
    if (!spec) return;
    // recode/ifThen with string outputs are categorical by nature
    const resolvedType: ColumnType = op === "recode" ? "categorical" : type;
    const key = uniqueKey(sanitiseColumnKey(label, "computed"), new Set(Object.keys(state.schema)));
    const def: ComputedColumnDef = { key, label: label.trim(), type: resolvedType, spec };
    dispatch({ type: "addComputedColumn", def });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">New computed column</h3>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="label text-xs">Transform</span>
            <select className="select" value={op} onChange={(e) => setOp(e.target.value as Op)}>
              {Object.entries(OP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label text-xs">Type</span>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as ColumnType)}
              disabled={op === "recode"}>
              <option value="numeric">Numeric</option>
              <option value="ordinal">Ordinal</option>
              <option value="categorical">Categorical</option>
            </select>
          </label>
        </div>

        <label className="block mb-4">
          <span className="label text-xs">Name</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. log RT" />
        </label>

        {(op === "mean" || op === "sum") && (
          <div className="space-y-2 mb-4">
            <span className="label text-xs">Columns</span>
            {inputs.map((id, i) => (
              <div key={i} className="flex gap-2">
                <select className="select flex-1" value={id} onChange={(e) =>
                  setInputs((arr) => arr.map((x, j) => j === i ? e.target.value : x))}>
                  <option value="">— select —</option>
                  {numericCols.map((c) => <option key={c} value={c}>{colLabel(c)}</option>)}
                </select>
                {inputs.length > 2 && (
                  <button className="btn btn-ghost" onClick={() => setInputs((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={() => setInputs((arr) => [...arr, ""])}>
              <Plus className="w-3.5 h-3.5" /> Add column
            </button>
          </div>
        )}

        {op === "diff" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Picker label="A" value={aCol} onChange={setACol} cols={numericCols} colLabel={colLabel} />
            <Picker label="B" value={bCol} onChange={setBCol} cols={numericCols} colLabel={colLabel} />
          </div>
        )}

        {(op === "zscore" || op === "log" || op === "recode") && (
          <Picker label="Input column" value={aCol} onChange={setACol} cols={numericCols} colLabel={colLabel} />
        )}

        {op === "log" && (
          <label className="block mt-2 mb-4">
            <span className="label text-xs">Offset (log(x + offset))</span>
            <input type="number" className="input" value={offset} onChange={(e) => setOffset(parseFloat(e.target.value) || 0)} />
          </label>
        )}

        {op === "recode" && (
          <div className="space-y-2 mt-2 mb-4">
            <span className="label text-xs">Bands (inclusive range → label)</span>
            {bins.map((b, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input type="number" className="input w-20" value={b.from}
                  onChange={(e) => setBins((arr) => arr.map((x, j) => j === i ? { ...x, from: parseFloat(e.target.value) } : x))} />
                <span className="text-xs">to</span>
                <input type="number" className="input w-20" value={b.to}
                  onChange={(e) => setBins((arr) => arr.map((x, j) => j === i ? { ...x, to: parseFloat(e.target.value) } : x))} />
                <input className="input flex-1" placeholder="label" value={b.label}
                  onChange={(e) => setBins((arr) => arr.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <button className="btn btn-ghost" onClick={() => setBins((arr) => arr.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button className="btn btn-ghost text-xs flex items-center gap-1"
              onClick={() => setBins((arr) => [...arr, { from: 0, to: 0, label: "" }])}>
              <Plus className="w-3.5 h-3.5" /> Add band
            </button>
          </div>
        )}

        {op === "ifThen" && (
          <div className="space-y-3 mb-4">
            <Picker label="Condition column" value={conditionCol} onChange={setConditionCol} cols={allCols} colLabel={colLabel} />
            <div className="grid grid-cols-3 gap-2">
              <select className="select" value={compareOp} onChange={(e) => setCompareOp(e.target.value as CompareOp)}>
                {(["==", "!=", "<", "<=", ">", ">="] as CompareOp[]).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <input className="input" placeholder="value" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} />
              <div />
              <input className="input" placeholder="then" value={thenValue} onChange={(e) => setThenValue(e.target.value)} />
              <input className="input" placeholder="else" value={elseValue} onChange={(e) => setElseValue(e.target.value)} />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-[color:var(--danger)] mb-3">{error}</p>}

        <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border)]">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Create</button>
        </div>
      </div>
    </div>
  );
}

function Picker({
  label, value, onChange, cols, colLabel,
}: { label: string; value: string; onChange: (v: string) => void; cols: string[]; colLabel: (c: string) => string }) {
  return (
    <label className="block">
      <span className="label text-xs">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— select —</option>
        {cols.map((c) => <option key={c} value={c}>{colLabel(c)}</option>)}
      </select>
    </label>
  );
}
