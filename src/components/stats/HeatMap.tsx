"use client";

export function HeatMap({
  matrix, rowLabels, colLabels, height = 280, valueFormat,
}: {
  matrix: number[][]; rowLabels: string[]; colLabels: string[];
  height?: number;
  valueFormat?: (v: number, r: number, c: number) => string;
}) {
  if (!matrix.length || !matrix[0]?.length) return <p className="text-xs text-[color:var(--muted)]">No data</p>;
  const w = 480, padL = 90, padR = 12, padT = 40, padB = 12;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const rows = matrix.length, cols = matrix[0].length;
  const cellW = innerW / cols, cellH = innerH / rows;
  const flat = matrix.flat();
  const max = Math.max(...flat), min = Math.min(...flat);
  const color = (v: number) => {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    const r = Math.round(238 + (49 - 238) * t);
    const g = Math.round(242 + (46 - 242) * t);
    const b = Math.round(255 + (129 - 255) * t);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto">
      {colLabels.map((c, j) => (
        <text key={j} x={padL + cellW * (j + 0.5)} y={padT - 8} fontSize="10" fill="var(--fg)" textAnchor="middle">
          {truncate(c, 12)}
        </text>
      ))}
      {rowLabels.map((r, i) => (
        <text key={i} x={padL - 6} y={padT + cellH * (i + 0.5) + 4} fontSize="10" fill="var(--fg)" textAnchor="end">
          {truncate(r, 14)}
        </text>
      ))}
      {matrix.map((row, i) =>
        row.map((v, j) => (
          <g key={`${i}-${j}`}>
            <rect x={padL + j * cellW} y={padT + i * cellH} width={cellW} height={cellH} fill={color(v)} stroke="#fff" />
            <text x={padL + cellW * (j + 0.5)} y={padT + cellH * (i + 0.5) + 4} fontSize="10" fill="#1e1b4b" textAnchor="middle">
              {valueFormat ? valueFormat(v, i, j) : v.toString()}
            </text>
          </g>
        ))
      )}
    </svg>
  );
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
