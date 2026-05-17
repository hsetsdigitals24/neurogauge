"use client";
import { HistogramBin } from "@/lib/stats";

export function Histogram({ bins, height = 220, label }: { bins: HistogramBin[]; height?: number; label?: string }) {
  if (!bins || bins.length === 0) return <p className="text-xs text-[color:var(--muted)]">No data</p>;
  const w = 480, padL = 36, padR = 8, padT = 12, padB = 30;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const maxCount = Math.max(...bins.map((b) => b.count));
  const xMin = bins[0].lo, xMax = bins[bins.length - 1].hi;
  const xScale = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * innerW;
  const yScale = (c: number) => padT + innerH - (c / maxCount) * innerH;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto">
      {label && <text x={padL} y={10} fontSize="10" fill="var(--muted)">{label}</text>}
      {bins.map((b, i) => {
        const x = xScale(b.lo);
        const bw = xScale(b.hi) - xScale(b.lo) - 1;
        const y = yScale(b.count);
        const bh = innerH + padT - y;
        return <rect key={i} x={x} y={y} width={Math.max(bw, 1)} height={bh} fill="#6366f1" opacity={0.75} />;
      })}
      <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#cbd5e1" />
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />
      <text x={padL} y={height - 6} fontSize="9" fill="var(--muted)">{xMin.toFixed(2)}</text>
      <text x={w - padR} y={height - 6} fontSize="9" fill="var(--muted)" textAnchor="end">{xMax.toFixed(2)}</text>
      <text x={padL - 4} y={padT + 8} fontSize="9" fill="var(--muted)" textAnchor="end">{maxCount}</text>
      <text x={padL - 4} y={padT + innerH} fontSize="9" fill="var(--muted)" textAnchor="end">0</text>
    </svg>
  );
}
