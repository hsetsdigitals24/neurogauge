"use client";
import { useWorkspace } from "./WorkspaceProvider";
import { transformLabel } from "@/lib/stats";

export function VariableView({ onEdit }: { onEdit: (id: string) => void }) {
  const ws = useWorkspace();
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-[color:var(--muted)] sticky top-0 bg-white">
          <tr>
            <th className="py-2 pr-3">Label</th>
            <th className="pr-3">Role</th>
            <th className="pr-3">Kind</th>
            <th className="pr-3">Source / transform</th>
            <th>n</th>
          </tr>
        </thead>
        <tbody>
          {ws.variables.map((v) => {
            const rows = v.role === "nominal" ? ws.getCategoricalRows(v.id).length : ws.getNumericRows(v.id).length;
            return (
              <tr key={v.id} className="border-t border-[color:var(--border)] hover:bg-gray-50 cursor-pointer"
                onClick={() => onEdit(v.id)}>
                <td className="py-1.5 pr-3 font-semibold">{v.label}</td>
                <td className="pr-3 capitalize">{v.role}</td>
                <td className="pr-3 text-[color:var(--muted)]">{v.source.kind}</td>
                <td className="pr-3 font-mono text-[10px] text-[color:var(--muted)] truncate max-w-xs">
                  {v.source.kind === "derived"
                    ? transformLabel(v.source.transform, (id) => ws.labelOf(id))
                    : describeNative(v.source.variable)}
                </td>
                <td className="font-mono">{rows}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeNative(v: any): string {
  if (v.kind === "block-metric") return `block.${v.metric}${v.level != null ? `.lvl${v.level}` : ""}`;
  if (v.kind === "tlx") return `tlx.${v.scope}.${v.dim}${v.level != null ? `.lvl${v.level}` : ""}`;
  if (v.kind === "demographic") return `demo.${v.field}`;
  if (v.kind === "custom") return `custom.${v.questionId}`;
  return JSON.stringify(v);
}
