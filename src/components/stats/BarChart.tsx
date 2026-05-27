"use client";

export interface Bar { name: string; value: number; errLow?: number; errHigh?: number; color?: string; }

export function BarChart({
  bars, height = 240, yLabel, refLines = [], baseline = 0,
}: {
  bars: Bar[]; height?: number; yLabel?: string;
  refLines?: { y: number; label: string; color?: string }[];
  baseline?: number;
}) {
  if (!bars.length) return <p className="text-xs text-[color:var(--muted)]">No data</p>;
  const w = 480, padL = 50, padR = 12, padT = 14, padB = 40;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const vals = bars.flatMap((b) => [b.value, b.errLow ?? b.value, b.errHigh ?? b.value]);
  const refVals = refLines.map((r) => r.y);
  const all = [...vals, ...refVals, baseline];
  const yMin = Math.min(...all);
  const yMax = Math.max(...all);
  const pad = (yMax - yMin) * 0.1 || 1;
  const lo = yMin - pad, hi = yMax + pad;
  const yScale = (v: number) => padT + innerH - ((v - lo) / (hi - lo || 1)) * innerH;
  const slot = innerW / bars.length;
  const bw = Math.min(50, slot * 0.7);

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
      {refLines.map((r, i) => {
        const y = yScale(r.y);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke={r.color ?? "#ef4444"} strokeDasharray="3,3" opacity={0.7} />
            <text x={w - padR - 2} y={y - 2} fontSize="9" fill={r.color ?? "#ef4444"} textAnchor="end">{r.label}</text>
          </g>
        );
      })}
      {bars.map((b, i) => {
        const cx = padL + slot * (i + 0.5);
        const y0 = yScale(baseline);
        const yv = yScale(b.value);
        const top = Math.min(y0, yv);
        const h = Math.abs(y0 - yv);
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(h, 1)} fill={b.color ?? "#6366f1"} opacity={0.85} />
            {b.errLow != null && b.errHigh != null && (
              <g>
                <line x1={cx} y1={yScale(b.errLow)} x2={cx} y2={yScale(b.errHigh)} stroke="#1e1b4b" />
                <line x1={cx - 6} y1={yScale(b.errLow)} x2={cx + 6} y2={yScale(b.errLow)} stroke="#1e1b4b" />
                <line x1={cx - 6} y1={yScale(b.errHigh)} x2={cx + 6} y2={yScale(b.errHigh)} stroke="#1e1b4b" />
              </g>
            )}
            <text x={cx} y={height - 22} fontSize="10" fill="var(--fg)" textAnchor="middle">{truncate(b.name, 14)}</text>
            <text x={cx} y={height - 10} fontSize="9" fill="var(--muted)" textAnchor="middle">{b.value.toFixed(2)}</text>
          </g>
        );
      })}
      {yLabel && <text x={10} y={padT + innerH / 2} fontSize="9" fill="var(--muted)" transform={`rotate(-90 10 ${padT + innerH / 2})`} textAnchor="middle">{yLabel}</text>}
    </svg>
  );
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
