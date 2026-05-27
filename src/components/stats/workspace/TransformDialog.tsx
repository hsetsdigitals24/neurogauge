"use client";
import { useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { Transform, VariableDef } from "@/lib/stats";
import { X, Plus, Trash2 } from "lucide-react";

type Op = Transform["op"];

const OP_LABELS: Record<Op, string> = {
  mean: "Mean of items",
  sum: "Sum of items",
  diff: "A − B (difference)",
  zscore: "Standardise (z-score)",
  log: "Log transform",
  recode: "Recode into bands",
  ifThen: "If-then",
};

export function TransformDialog({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace();
  const numericVars = ws.variables.filter((v) => v.role !== "nominal");
  const allVars = ws.variables;

  const [op, setOp] = useState<Op>("mean");
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<VariableDef["role"]>("numeric");
  const [inputs, setInputs] = useState<string[]>([numericVars[0]?.id ?? "", numericVars[1]?.id ?? ""]);
  const [aId, setAId] = useState(numericVars[0]?.id ?? "");
  const [bId, setBId] = useState(numericVars[1]?.id ?? "");
  const [offset, setOffset] = useState<number>(1);
  const [bins, setBins] = useState<{ from: number; to: number; label: string }[]>([
    { from: 0, to: 33, label: "low" },
    { from: 34, to: 66, label: "mid" },
    { from: 67, to: 100, label: "high" },
  ]);
  const [conditionVarId, setConditionVarId] = useState(allVars[0]?.id ?? "");
  const [compareOp, setCompareOp] = useState<"==" | "!=" | "<" | "<=" | ">" | ">=">(">");
  const [conditionValue, setConditionValue] = useState<string>("0");
  const [thenValue, setThenValue] = useState<string>("1");
  const [elseValue, setElseValue] = useState<string>("0");

  function save() {
    if (!label.trim()) return;
    let t: Transform;
    if (op === "mean" || op === "sum") {
      const clean = inputs.filter(Boolean);
      if (clean.length < 2) return;
      t = { op, inputIds: clean };
    } else if (op === "diff") {
      if (!aId || !bId) return;
      t = { op: "diff", aId, bId };
    } else if (op === "zscore") {
      if (!aId) return;
      t = { op: "zscore", inputId: aId };
    } else if (op === "log") {
      if (!aId) return;
      t = { op: "log", inputId: aId, offset };
    } else if (op === "recode") {
      if (!aId || bins.length === 0) return;
      t = { op: "recode", inputId: aId, bins };
    } else {
      const cv = parseFloat(conditionValue);
      const tv = parseFloat(thenValue);
      const ev = parseFloat(elseValue);
      t = {
        op: "ifThen", conditionVarId, compareOp,
        value: isFinite(cv) ? cv : conditionValue,
        thenValue: isFinite(tv) ? tv : thenValue,
        elseValue: isFinite(ev) ? ev : elseValue,
      };
    }
    ws.addDerivedVariable(label.trim(), role, t);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">New derived variable</h3>
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
            <span className="label text-xs">Role</span>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as VariableDef["role"])}>
              <option value="numeric">Numeric</option>
              <option value="ordinal">Ordinal</option>
              <option value="nominal">Nominal</option>
            </select>
          </label>
        </div>

        <label className="block mb-4">
          <span className="label text-xs">Name</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. TLX sum" />
        </label>

        {(op === "mean" || op === "sum") && (
          <div className="space-y-2 mb-4">
            <span className="label text-xs">Items</span>
            {inputs.map((id, i) => (
              <div key={i} className="flex gap-2">
                <select className="select flex-1" value={id} onChange={(e) =>
                  setInputs((arr) => arr.map((x, j) => j === i ? e.target.value : x))}>
                  <option value="">— select —</option>
                  {numericVars.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
                {inputs.length > 2 && (
                  <button className="btn btn-ghost" onClick={() => setInputs((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={() => setInputs((arr) => [...arr, ""])}>
              <Plus className="w-3.5 h-3.5" /> Add item
            </button>
          </div>
        )}

        {op === "diff" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Picker label="A" value={aId} onChange={setAId} options={numericVars} />
            <Picker label="B" value={bId} onChange={setBId} options={numericVars} />
          </div>
        )}

        {(op === "zscore" || op === "log" || op === "recode") && (
          <Picker label="Input variable" value={aId} onChange={setAId} options={numericVars} />
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
            <Picker label="Condition variable" value={conditionVarId} onChange={setConditionVarId} options={allVars} />
            <div className="grid grid-cols-3 gap-2">
              <select className="select" value={compareOp} onChange={(e) => setCompareOp(e.target.value as typeof compareOp)}>
                {["==", "!=", "<", "<=", ">", ">="].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <input className="input" placeholder="value" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} />
              <div />
              <input className="input" placeholder="then" value={thenValue} onChange={(e) => setThenValue(e.target.value)} />
              <input className="input" placeholder="else" value={elseValue} onChange={(e) => setElseValue(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border)]">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Create</button>
        </div>
      </div>
    </div>
  );
}

function Picker({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: VariableDef[] }) {
  return (
    <label className="block">
      <span className="label text-xs">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— select —</option>
        {options.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
    </label>
  );
}
