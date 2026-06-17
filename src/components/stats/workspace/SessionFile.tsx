"use client";
import { useRef } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { toFile, downloadJson, SessionFileV1, clearLocal } from "@/lib/stats";
import { Save, Upload, Trash2 } from "lucide-react";
import { notify } from "@/lib/toast";

export function SessionFile() {
  const ws = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);

  function save() {
    const file = toFile(ws.state);
    downloadJson(`workspace_${ws.state.projectId}_${new Date().toISOString().slice(0, 10)}.json`, file);
  }

  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as SessionFileV1;
        if (parsed.version !== 1) { notify.error("Unsupported file version."); return; }
        const native = ws.variables.filter((v) => v.source.kind === "native");
        const derived = parsed.variables.filter((v) => v.source.kind === "derived");
        const nativeMap = new Map(native.map((v) => [v.id, v]));
        for (const sv of parsed.variables) {
          if (sv.source.kind === "native" && nativeMap.has(sv.id)) {
            nativeMap.set(sv.id, { ...nativeMap.get(sv.id)!, label: sv.label, role: sv.role });
          }
        }
        ws.dispatch({ type: "load", state: {
          projectId: ws.state.projectId,
          centerTab: "data", activeDialog: null,
          variables: [...nativeMap.values(), ...derived],
          filter: parsed.filter ?? { clauses: [] },
          outputs: parsed.outputs ?? [],
        }});
        notify.success("Workspace loaded");
      } catch {
        notify.error("Could not parse session file.");
      }
    };
    reader.readAsText(file);
  }

  function reset() {
    if (!confirm("Reset workspace? Derived variables, filters, and output will be cleared.")) return;
    clearLocal(ws.state.projectId);
    ws.dispatch({ type: "reset" });
  }

  return (
    <div className="flex items-center gap-1">
      <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={save}>
        <Save className="w-3.5 h-3.5" /> Save
      </button>
      <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={() => inputRef.current?.click()}>
        <Upload className="w-3.5 h-3.5" /> Load
      </button>
      <input ref={inputRef} type="file" accept=".json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
      <button className="btn btn-ghost text-xs flex items-center gap-1 text-[color:var(--danger)]" onClick={reset}>
        <Trash2 className="w-3.5 h-3.5" /> Reset
      </button>
    </div>
  );
}
