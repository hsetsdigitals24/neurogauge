"use client";

export interface LineSeries {
  name: string;
  points: { x: number | string; y: number; errLow?: number; errHigh?: number }[];
  color?: string;
}

const PALETTE = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

export function LinePlot({
  series, height = 280, xLabel, yLabel, xAxisCategorical,
}: {
  series: LineSeries[]; height?: number;
  xLabel?: string; yLabel?: string;
  xAxisCategorical?: string[];
}) {
  if (!series.length || !series[0].points.length) return <p className="text-xs text-[color:var(--muted)]">No data</p>;
  const w = 480, padL = 50, padR = 90, padT = 14, padB = 38;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const allY = series.flatMap((s) => s.points.flatMap((p) => [p.y, p.errLow ?? p.y, p.errHigh ?? p.y]));
  const yMin = Math.min(...allY), yMax = Math.max(...allY);
  const pad = (yMax - yMin) * 0.1 || 1;
  const lo = yMin - pad, hi = yMax + pad;

  const xs = xAxisCategorical ?? Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x)))).sort((a, b) =>
    typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));
  const xScale = (x: number | string) => {
    const i = xs.indexOf(x);
    if (xs.length === 1) return padL + innerW / 2;
    return padL + (i / (xs.length - 1)) * innerW;
  };
  const yScale = (v: number) => padT + innerH - ((v - lo) / (hi - lo || 1)) * innerH;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto">
      <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#cbd5e1" />
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + innerH - t * innerH;
        const v = lo + t * (hi - lo);
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="#f1f5f9" />
            <text x={padL - 4} y={y + 3} fontSize="9" fill="var(--muted)" textAnchor="end">{v.toFixed(2)}</text>
          </g>
        );
      })}
      {xs.map((x, i) => (
        <text key={i} x={xScale(x)} y={height - 18} fontSize="10" fill="var(--fg)" textAnchor="middle">{String(x)}</text>
      ))}
      {series.map((s, idx) => {
        const c = s.color ?? PALETTE[idx % PALETTE.length];
        const pts = s.points.filter((p) => xs.indexOf(p.x) >= 0);
        const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.x)},${yScale(p.y)}`).join(" ");
        return (
          <g key={s.name}>
            <path d={path} fill="none" stroke={c} strokeWidth={1.8} />
            {pts.map((p, i) => (
              <g key={i}>
                {p.errLow != null && p.errHigh != null && (
                  <line x1={xScale(p.x)} y1={yScale(p.errLow)} x2={xScale(p.x)} y2={yScale(p.errHigh)} stroke={c} opacity={0.6} />
                )}
                <circle cx={xScale(p.x)} cy={yScale(p.y)} r={3} fill={c} />
              </g>
            ))}
            <g transform={`translate(${padL + innerW + 8} ${padT + idx * 18})`}>
              <line x1={0} y1={6} x2={14} y2={6} stroke={c} strokeWidth={1.8} />
              <circle cx={7} cy={6} r={2.5} fill={c} />
              <text x={18} y={9} fontSize="10" fill="var(--fg)">{truncate(s.name, 12)}</text>
            </g>
          </g>
        );
      })}
      {xLabel && <text x={padL + innerW / 2} y={height - 4} fontSize="9" fill="var(--muted)" textAnchor="middle">{xLabel}</text>}
      {yLabel && <text x={10} y={padT + innerH / 2} fontSize="9" fill="var(--muted)" transform={`rotate(-90 10 ${padT + innerH / 2})`} textAnchor="middle">{yLabel}</text>}
    </svg>
  );
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
