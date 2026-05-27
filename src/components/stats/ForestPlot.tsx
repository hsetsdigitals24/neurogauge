"use client";

export interface ForestRow {
  name: string;
  value: number;
  ciLow: number;
  ciHigh: number;
  significant?: boolean;
}

export function ForestPlot({
  rows, height, refValue = 0, xLabel,
}: {
  rows: ForestRow[]; height?: number; refValue?: number; xLabel?: string;
}) {
  if (!rows.length) return <p className="text-xs text-[color:var(--muted)]">No data</p>;
  const rowH = 24;
  const h = height ?? Math.max(120, rows.length * rowH + 60);
  const w = 480, padL = 150, padR = 60, padT = 16, padB = 34;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const vals = rows.flatMap((r) => [r.value, r.ciLow, r.ciHigh, refValue]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.1 || 1;
  const xMin = lo - pad, xMax = hi + pad;
  const xScale = (v: number) => padL + ((v - xMin) / (xMax - xMin || 1)) * innerW;
  const rowY = (i: number) => padT + (innerH / rows.length) * (i + 0.5);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <line x1={xScale(refValue)} y1={padT} x2={xScale(refValue)} y2={padT + innerH} stroke="#cbd5e1" strokeDasharray="3,3" />
      {rows.map((r, i) => {
        const y = rowY(i);
        const color = r.significant ? "#4f46e5" : "#64748b";
        return (
          <g key={i}>
            <text x={padL - 8} y={y + 4} fontSize="10" fill="var(--fg)" textAnchor="end">{truncate(r.name, 22)}</text>
            <line x1={xScale(r.ciLow)} y1={y} x2={xScale(r.ciHigh)} y2={y} stroke={color} />
            <line x1={xScale(r.ciLow)} y1={y - 4} x2={xScale(r.ciLow)} y2={y + 4} stroke={color} />
            <line x1={xScale(r.ciHigh)} y1={y - 4} x2={xScale(r.ciHigh)} y2={y + 4} stroke={color} />
            <rect x={xScale(r.value) - 4} y={y - 4} width={8} height={8} fill={color} />
            <text x={xScale(r.ciHigh) + 6} y={y + 4} fontSize="9" fill="var(--muted)">
              {r.value.toFixed(2)} [{r.ciLow.toFixed(2)}, {r.ciHigh.toFixed(2)}]
            </text>
          </g>
        );
      })}
      <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#cbd5e1" />
      {[xMin, (xMin + xMax) / 2, xMax].map((v, i) => (
        <text key={i} x={xScale(v)} y={h - 18} fontSize="9" fill="var(--muted)" textAnchor="middle">{v.toFixed(2)}</text>
      ))}
      {xLabel && <text x={padL + innerW / 2} y={h - 4} fontSize="9" fill="var(--muted)" textAnchor="middle">{xLabel}</text>}
    </svg>
  );
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
