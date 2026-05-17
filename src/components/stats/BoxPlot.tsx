"use client";
import { percentile } from "@/lib/stats";

export interface BoxSeries { name: string; values: number[]; }

export function BoxPlot({ groups, height = 260, yLabel }: { groups: BoxSeries[]; height?: number; yLabel?: string }) {
  const clean = groups.map((g) => ({ name: g.name, values: g.values.filter(isFinite).sort((a, b) => a - b) })).filter((g) => g.values.length > 0);
  if (clean.length === 0) return <p className="text-xs text-[color:var(--muted)]">No data</p>;
  const w = 480, padL = 50, padR = 12, padT = 14, padB = 36;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const all = clean.flatMap((g) => g.values);
  const yMin = Math.min(...all), yMax = Math.max(...all);
  const pad = (yMax - yMin) * 0.05 || 1;
  const lo = yMin - pad, hi = yMax + pad;
  const yScale = (v: number) => padT + innerH - ((v - lo) / (hi - lo || 1)) * innerH;
  const slot = innerW / clean.length;
  const boxW = Math.min(40, slot * 0.5);

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto">
      <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#cbd5e1" />
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + innerH - t * innerH;
        const v = lo + t * (hi - lo);
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#f1f5f9" />
            <text x={padL - 4} y={y + 3} fontSize="9" fill="var(--muted)" textAnchor="end">{v.toFixed(2)}</text>
          </g>
        );
      })}
      {clean.map((g, i) => {
        const cx = padL + slot * (i + 0.5);
        const med = percentile(g.values, 0.5);
        const q1 = percentile(g.values, 0.25);
        const q3 = percentile(g.values, 0.75);
        const iqr = q3 - q1;
        const whiskerLo = Math.max(g.values[0], q1 - 1.5 * iqr);
        const whiskerHi = Math.min(g.values[g.values.length - 1], q3 + 1.5 * iqr);
        const outliers = g.values.filter((v) => v < whiskerLo || v > whiskerHi);
        return (
          <g key={g.name}>
            <line x1={cx} y1={yScale(whiskerHi)} x2={cx} y2={yScale(whiskerLo)} stroke="#475569" />
            <line x1={cx - boxW / 3} y1={yScale(whiskerHi)} x2={cx + boxW / 3} y2={yScale(whiskerHi)} stroke="#475569" />
            <line x1={cx - boxW / 3} y1={yScale(whiskerLo)} x2={cx + boxW / 3} y2={yScale(whiskerLo)} stroke="#475569" />
            <rect x={cx - boxW / 2} y={yScale(q3)} width={boxW} height={yScale(q1) - yScale(q3)} fill="#6366f1" opacity={0.7} stroke="#4338ca" />
            <line x1={cx - boxW / 2} y1={yScale(med)} x2={cx + boxW / 2} y2={yScale(med)} stroke="#1e1b4b" strokeWidth={2} />
            {outliers.map((v, k) => <circle key={k} cx={cx} cy={yScale(v)} r={2} fill="#ef4444" />)}
            <text x={cx} y={height - 18} fontSize="10" fill="var(--fg)" textAnchor="middle">{truncate(g.name, 14)}</text>
            <text x={cx} y={height - 6} fontSize="9" fill="var(--muted)" textAnchor="middle">n={g.values.length}</text>
          </g>
        );
      })}
      {yLabel && <text x={10} y={padT + innerH / 2} fontSize="9" fill="var(--muted)" transform={`rotate(-90 10 ${padT + innerH / 2})`} textAnchor="middle">{yLabel}</text>}
    </svg>
  );
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
