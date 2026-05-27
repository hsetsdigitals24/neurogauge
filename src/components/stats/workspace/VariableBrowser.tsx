"use client";
import { useState, useMemo } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { Hash, ListOrdered, Tag, Search, Wand2 } from "lucide-react";
import { VariableDef } from "@/lib/stats";

const ROLE_ICON = {
  numeric: Hash, ordinal: ListOrdered, nominal: Tag,
} as const;

export function VariableBrowser({
  onEdit, onNewTransform,
}: {
  onEdit: (variableId: string) => void;
  onNewTransform: () => void;
}) {
  const ws = useWorkspace();
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const native: VariableDef[] = [];
    const derived: VariableDef[] = [];
    for (const v of ws.variables) {
      if (q && !v.label.toLowerCase().includes(q.toLowerCase())) continue;
      (v.source.kind === "native" ? native : derived).push(v);
    }
    return { native, derived };
  }, [ws.variables, q]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-[color:var(--border)]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" />
          <input
            className="input w-full pl-7 text-xs py-1.5"
            placeholder="Search variables…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {groups.derived.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[color:var(--muted)] font-semibold px-2 mb-1">
              Derived ({groups.derived.length})
            </div>
            <ul className="space-y-0.5">
              {groups.derived.map((v) => <Row key={v.id} v={v} onEdit={onEdit} />)}
            </ul>
          </div>
        )}
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[color:var(--muted)] font-semibold px-2 mb-1">
            Native ({groups.native.length})
          </div>
          <ul className="space-y-0.5">
            {groups.native.map((v) => <Row key={v.id} v={v} onEdit={onEdit} />)}
          </ul>
        </div>
      </div>
      <div className="p-2 border-t border-[color:var(--border)]">
        <button onClick={onNewTransform} className="btn btn-primary w-full text-xs flex items-center justify-center gap-1">
          <Wand2 className="w-3.5 h-3.5" /> Compute new variable
        </button>
      </div>
    </div>
  );
}

function Row({ v, onEdit }: { v: VariableDef; onEdit: (id: string) => void }) {
  const Icon = ROLE_ICON[v.role];
  return (
    <li>
      <button
        onClick={() => onEdit(v.id)}
        className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-gray-50 flex items-start gap-2 text-[color:var(--fg)]"
      >
        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[color:var(--muted)]" />
        <span className="min-w-0 flex-1 break-words">{v.label}</span>
      </button>
    </li>
  );
}
