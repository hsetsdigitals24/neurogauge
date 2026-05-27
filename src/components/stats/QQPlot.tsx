"use client";
import { QQPoint } from "@/lib/stats";

export function QQPlot({ points, height = 220 }: { points: QQPoint[]; height?: number }) {
  if (!points || points.length === 0) return <p className="text-xs text-[color:var(--muted)]">No data</p>;
  const w = 480, padL = 40, padR = 12, padT = 12, padB = 30;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const xs = points.map((p) => p.theoretical);
  const ys = points.map((p) => p.sample);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xScale = (x: number) => padL + ((x - xMin) / (xMax - xMin || 1)) * innerW;
  const yScale = (y: number) => padT + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH;
  // Reference line via least squares
  const n = points.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den > 0 ? num / den : 1;
  const intercept = my - slope * mx;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto">
      <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#cbd5e1" />
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />
      <line
        x1={xScale(xMin)} y1={yScale(slope * xMin + intercept)}
        x2={xScale(xMax)} y2={yScale(slope * xMax + intercept)}
        stroke="#ef4444" strokeDasharray="3,3"
      />
      {points.map((p, i) => (
        <circle key={i} cx={xScale(p.theoretical)} cy={yScale(p.sample)} r={2.4} fill="#6366f1" />
      ))}
      <text x={padL} y={height - 6} fontSize="9" fill="var(--muted)">Theoretical {xMin.toFixed(2)}</text>
      <text x={w - padR} y={height - 6} fontSize="9" fill="var(--muted)" textAnchor="end">{xMax.toFixed(2)}</text>
      <text x={4} y={padT + 8} fontSize="9" fill="var(--muted)">Sample {yMax.toFixed(2)}</text>
      <text x={4} y={padT + innerH} fontSize="9" fill="var(--muted)">{yMin.toFixed(2)}</text>
    </svg>
  );
}
