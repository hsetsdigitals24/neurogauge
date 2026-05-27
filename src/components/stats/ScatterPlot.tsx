"use client";

export function ScatterPlot({
  x, y, height = 240, xLabel, yLabel, showLine = true,
}: {
  x: number[]; y: number[]; height?: number;
  xLabel?: string; yLabel?: string; showLine?: boolean;
}) {
  if (!x.length || x.length !== y.length) return <p className="text-xs text-[color:var(--muted)]">No data</p>;
  const w = 480, padL = 44, padR = 12, padT = 12, padB = 32;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const xMin = Math.min(...x), xMax = Math.max(...x);
  const yMin = Math.min(...y), yMax = Math.max(...y);
  const xScale = (v: number) => padL + ((v - xMin) / (xMax - xMin || 1)) * innerW;
  const yScale = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); den += (x[i] - mx) ** 2; }
  const slope = den > 0 ? num / den : 0;
  const intercept = my - slope * mx;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto">
      <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#cbd5e1" />
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />
      {showLine && (
        <line x1={xScale(xMin)} y1={yScale(slope * xMin + intercept)}
              x2={xScale(xMax)} y2={yScale(slope * xMax + intercept)}
              stroke="#ef4444" strokeWidth={1.5} />
      )}
      {x.map((xi, i) => (
        <circle key={i} cx={xScale(xi)} cy={yScale(y[i])} r={2.6} fill="#6366f1" opacity={0.8} />
      ))}
      {xLabel && <text x={padL + innerW / 2} y={height - 6} fontSize="9" fill="var(--muted)" textAnchor="middle">{xLabel}</text>}
      {yLabel && <text x={10} y={padT + innerH / 2} fontSize="9" fill="var(--muted)" transform={`rotate(-90 10 ${padT + innerH / 2})`} textAnchor="middle">{yLabel}</text>}
      <text x={padL} y={height - 16} fontSize="9" fill="var(--muted)">{xMin.toFixed(2)}</text>
      <text x={w - padR} y={height - 16} fontSize="9" fill="var(--muted)" textAnchor="end">{xMax.toFixed(2)}</text>
    </svg>
  );
}
