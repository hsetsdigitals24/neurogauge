"use client";
import { RocPoint } from "@/lib/stats";

export function ROCPlot({ points, height = 280, auc }: { points: RocPoint[]; height?: number; auc?: number }) {
  if (!points || points.length === 0) return <p className="text-xs text-[color:var(--muted)]">No data</p>;
  const w = 280, padL = 36, padR = 12, padT = 16, padB = 30;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const xScale = (v: number) => padL + v * innerW;
  const yScale = (v: number) => padT + innerH - v * innerH;
  const path = points.map((p, i) =>
    `${i === 0 ? "M" : "L"}${xScale(p.fpr)},${yScale(p.tpr)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto">
      <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#cbd5e1" />
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />
      <line x1={xScale(0)} y1={yScale(0)} x2={xScale(1)} y2={yScale(1)} stroke="#cbd5e1" strokeDasharray="3,3" />
      <path d={path} fill="none" stroke="#6366f1" strokeWidth={1.8} />
      <text x={padL + innerW / 2} y={height - 6} fontSize="9" fill="var(--muted)" textAnchor="middle">FPR (1 − specificity)</text>
      <text x={10} y={padT + innerH / 2} fontSize="9" fill="var(--muted)" transform={`rotate(-90 10 ${padT + innerH / 2})`} textAnchor="middle">TPR (sensitivity)</text>
      {auc != null && <text x={w - padR - 6} y={padT + innerH - 8} fontSize="11" fill="#4f46e5" textAnchor="end" fontWeight="bold">AUC = {auc.toFixed(3)}</text>}
    </svg>
  );
}
