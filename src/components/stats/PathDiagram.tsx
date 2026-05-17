"use client";

export interface PathEdge { label: string; coef: number; p: number; subscript?: string; }

export function PathDiagram({
  x, m, y, a, b, c, cPrime, indirect,
}: {
  x: string; m: string; y: string;
  a: PathEdge; b: PathEdge; c: PathEdge; cPrime: PathEdge;
  indirect?: { value: number; significant: boolean };
}) {
  const W = 480, H = 240;
  const xPos = { x: 80, y: 170 };
  const mPos = { x: 240, y: 70 };
  const yPos = { x: 400, y: 170 };

  const sig = (p: number) => p < 0.05;
  const stroke = (e: PathEdge) => (sig(e.p) ? "#4f46e5" : "#94a3b8");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="#475569" />
        </marker>
        <marker id="arrow-sig" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="#4f46e5" />
        </marker>
      </defs>
      {/* Edges */}
      {edge(xPos, mPos, a, "a")}
      {edge(mPos, yPos, b, "b")}
      {edge(xPos, yPos, cPrime, "c′", -28)}
      {/* Total effect c shown above c' */}
      <text x={(xPos.x + yPos.x) / 2} y={yPos.y + 36} textAnchor="middle" fontSize="10" fill="var(--muted)">
        Total c = {c.coef.toFixed(3)} (p = {c.p < 0.001 ? "< .001" : c.p.toFixed(3)})
      </text>
      {indirect && (
        <text x={(xPos.x + yPos.x) / 2} y={yPos.y + 50} textAnchor="middle" fontSize="10"
          fill={indirect.significant ? "#4f46e5" : "var(--muted)"}>
          Indirect a·b = {indirect.value.toFixed(3)}
        </text>
      )}
      {/* Nodes */}
      {node(xPos, x, "X")}
      {node(mPos, m, "M")}
      {node(yPos, y, "Y")}
    </svg>
  );

  function node(pos: { x: number; y: number }, name: string, role: string) {
    return (
      <g key={role}>
        <rect x={pos.x - 56} y={pos.y - 22} width={112} height={44} rx={8}
          fill="#eef2ff" stroke="#4f46e5" strokeWidth={1.4} />
        <text x={pos.x} y={pos.y - 6} fontSize="11" fontWeight="bold" fill="#1e1b4b" textAnchor="middle">{role}</text>
        <text x={pos.x} y={pos.y + 12} fontSize="9" fill="#1e1b4b" textAnchor="middle">{truncate(name, 18)}</text>
      </g>
    );
  }

  function edge(p1: { x: number; y: number }, p2: { x: number; y: number }, e: PathEdge, labelText: string, labelOffset = 0) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len, uy = dy / len;
    const startX = p1.x + ux * 56;
    const startY = p1.y + uy * 22;
    const endX = p2.x - ux * 56;
    const endY = p2.y - uy * 22;
    const mx = (startX + endX) / 2;
    const my = (startY + endY) / 2 + labelOffset;
    const c = stroke(e);
    const isSig = sig(e.p);
    return (
      <g key={labelText}>
        <line x1={startX} y1={startY} x2={endX} y2={endY} stroke={c} strokeWidth={1.6}
          markerEnd={isSig ? "url(#arrow-sig)" : "url(#arrow)"} />
        <text x={mx} y={my} fontSize="10" fill={c} textAnchor="middle">
          {labelText} = {e.coef.toFixed(3)} {e.p < 0.001 ? "***" : e.p < 0.01 ? "**" : e.p < 0.05 ? "*" : ""}
        </text>
      </g>
    );
  }
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
