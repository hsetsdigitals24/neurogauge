"use client";
import dynamic from "next/dynamic";
import { useRef, useState, useEffect } from "react";
import { Download, ChevronDown, SlidersHorizontal, RotateCcw } from "lucide-react";
import type { AnalysisResponse } from "@/lib/analytics/client";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type PlotlySpec = AnalysisResponse["plots"][number]["plotly"];
// Plotly traces/layout are loosely-typed JSON from the backend; we edit them structurally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Trace = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Layout = Record<string, any>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isNumberArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === "number";
}

// A trace whose distribution is a single sample (raw points in x or y) can be shown as a
// histogram, box, or violin interchangeably. Server-side precomputed boxes (q1/median/q3)
// and pre-binned bars carry no raw points, so they're excluded.
function isUnivariate(t: Trace): boolean {
  if (t.q1 !== undefined) return false;
  if (!["histogram", "box", "violin"].includes(String(t.type))) return false;
  return isNumberArray(t.y) || isNumberArray(t.x);
}

// A trace with paired x/y arrays can render as either a scatter or a bar chart.
function isBivariate(t: Trace): boolean {
  if (!["scatter", "bar"].includes(String(t.type))) return false;
  return isNumberArray(t.x) && isNumberArray(t.y);
}

function typeOptions(t: Trace): string[] {
  if (isUnivariate(t)) return ["histogram", "box", "violin"];
  if (isBivariate(t)) return ["scatter", "bar"];
  return [];
}

const SCATTER_MODES = ["markers", "lines", "lines+markers"];

// Sensible default chart width (px) and slider bounds. Charts are centered within the
// results pane and capped here so they read as tidy figures rather than full-width banners.
const DEFAULT_MAX_WIDTH = 680;
const MIN_WIDTH = 360;
const WIDTH_RANGE_MAX = 1100;

function colorEditable(t: Trace): boolean {
  return ["box", "violin", "bar", "scatter", "histogram"].includes(String(t.type));
}

// Remap a trace to a new chart type, keeping it a valid Plotly figure. Univariate types
// keep their sample in `y` (box/violin) or `x` (histogram); cartesian types keep x/y.
function convertTrace(trace: Trace, toType: string): Trace {
  const t = clone(trace);
  const from = String(t.type);
  if (from === toType) return t;
  t.type = toType;

  if (["box", "violin"].includes(toType)) {
    // Distribution shown vertically → values must live in `y`.
    if (!isNumberArray(t.y) && isNumberArray(t.x)) {
      t.y = t.x;
      delete t.x;
    }
    delete t.mode;
    delete t.nbinsx;
  } else if (toType === "histogram") {
    // Histogram bins along `x`.
    if (!isNumberArray(t.x) && isNumberArray(t.y)) {
      t.x = t.y;
      delete t.y;
    }
    delete t.mode;
    delete t.boxpoints;
  } else if (toType === "scatter") {
    t.mode = t.mode ?? "markers";
    delete t.boxpoints;
    delete t.nbinsx;
  } else if (toType === "bar") {
    delete t.mode;
    delete t.boxpoints;
    delete t.nbinsx;
  }
  return t;
}

export function PlotEditor({ plot, index }: { plot: AnalysisResponse["plots"][number]; index: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [spec, setSpec] = useState<PlotlySpec>(() => clone(plot.plotly));
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Per-chart display width (px). Charts are centered and capped at this so they don't
  // stretch across a wide results pane. Editable via the Customize panel's Width slider.
  const [maxWidth, setMaxWidth] = useState(DEFAULT_MAX_WIDTH);

  // Re-seed from the backend whenever a new analysis is run (the plot prop changes).
  // Done during render per React's "adjust state when a prop changes" guidance.
  const [seededFrom, setSeededFrom] = useState(plot);
  if (seededFrom !== plot) {
    setSeededFrom(plot);
    setSpec(clone(plot.plotly));
    setMaxWidth(DEFAULT_MAX_WIDTH);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-plot-dl="${index}"]`)) setMenuOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen, index]);

  const traces = (spec.data ?? []) as Trace[];
  const layout = (spec.layout ?? {}) as Layout;
  const hasXAxis = layout.xaxis !== undefined;
  const hasYAxis = layout.yaxis !== undefined;

  function patchLayout(fn: (l: Layout) => void) {
    setSpec((prev) => {
      const next = clone(prev);
      next.layout = (next.layout ?? {}) as Layout;
      fn(next.layout as Layout);
      return next;
    });
  }

  function patchTrace(i: number, fn: (t: Trace) => void) {
    setSpec((prev) => {
      const next = clone(prev);
      const t = (next.data as Trace[])[i];
      fn(t);
      return next;
    });
  }

  function setAxisTitle(axis: "title" | "xaxis" | "yaxis", text: string) {
    patchLayout((l) => {
      if (axis === "title") {
        l.title = { ...(l.title ?? {}), text };
      } else {
        l[axis] = { ...(l[axis] ?? {}), title: { ...(l[axis]?.title ?? {}), text } };
      }
    });
  }

  function changeType(i: number, toType: string) {
    setSpec((prev) => {
      const next = clone(prev);
      (next.data as Trace[])[i] = convertTrace((next.data as Trace[])[i], toType);
      return next;
    });
  }

  function setTraceColor(i: number, color: string) {
    patchTrace(i, (t) => {
      t.marker = { ...(t.marker ?? {}), color };
      t.line = { ...(t.line ?? {}), color };
    });
  }

  function toggleVisible(i: number, visible: boolean) {
    patchTrace(i, (t) => {
      t.visible = visible ? true : "legendonly";
    });
  }

  async function downloadImage(format: "png" | "svg") {
    const node = containerRef.current?.querySelector(".js-plotly-plot") as HTMLElement | null;
    if (!node) return;
    const Plotly = (await import("plotly.js-dist-min")).default as unknown as {
      downloadImage: (gd: HTMLElement, opts: Record<string, unknown>) => Promise<string>;
    };
    await Plotly.downloadImage(node, {
      format,
      filename: `analysis_plot_${index + 1}`,
      width: 1200,
      height: 600,
      ...(format === "png" ? { scale: 2 } : {}),
    });
    setMenuOpen(false);
  }

  function currentText(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  return (
    <div className="rounded-lg border border-[color:var(--border)] overflow-hidden">
      <div className="flex justify-end gap-1 px-2 pt-2">
        <button
          type="button"
          onClick={() => setEditing((o) => !o)}
          className={`btn btn-ghost text-xs flex items-center gap-1 py-0.5 ${editing ? "text-[color:var(--primary)]" : ""}`}
          aria-pressed={editing}
        >
          <SlidersHorizontal className="w-3 h-3" /> Customize
        </button>
        <div className="relative" data-plot-dl={index}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="btn btn-ghost text-xs flex items-center gap-1 py-0.5"
          >
            <Download className="w-3 h-3" /> Download <ChevronDown className="w-3 h-3" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-32 bg-white border border-[color:var(--border)] rounded-lg shadow-lg z-10 overflow-hidden">
              <button type="button" onClick={() => downloadImage("png")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">PNG (2×)</button>
              <button type="button" onClick={() => downloadImage("svg")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">SVG (vector)</button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="mx-2 mb-2 p-3 rounded-lg bg-gray-50 border border-[color:var(--border)] space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[color:var(--muted)] uppercase tracking-wide">Customize chart</span>
            <button
              type="button"
              onClick={() => { setSpec(clone(plot.plotly)); setMaxWidth(DEFAULT_MAX_WIDTH); }}
              className="btn btn-ghost text-xs flex items-center gap-1 py-0.5"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Display width */}
          <label className="flex items-center gap-2">
            <span className="text-[color:var(--muted)] min-w-[3.5rem]">Width</span>
            <input
              type="range"
              min={MIN_WIDTH}
              max={WIDTH_RANGE_MAX}
              step={20}
              value={maxWidth}
              onChange={(e) => setMaxWidth(Number(e.target.value))}
              className="flex-1 accent-[color:var(--primary)]"
            />
            <span className="font-mono text-[color:var(--muted)] w-12 text-right">{maxWidth}px</span>
          </label>

          {/* Titles */}
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[color:var(--muted)]">Title</span>
              <input
                type="text"
                value={currentText(layout.title?.text)}
                onChange={(e) => setAxisTitle("title", e.target.value)}
                className="border border-[color:var(--border)] rounded px-2 py-1 bg-white"
              />
            </label>
            {hasXAxis && (
              <label className="flex flex-col gap-1">
                <span className="text-[color:var(--muted)]">X axis</span>
                <input
                  type="text"
                  value={currentText(layout.xaxis?.title?.text)}
                  onChange={(e) => setAxisTitle("xaxis", e.target.value)}
                  className="border border-[color:var(--border)] rounded px-2 py-1 bg-white"
                />
              </label>
            )}
            {hasYAxis && (
              <label className="flex flex-col gap-1">
                <span className="text-[color:var(--muted)]">Y axis</span>
                <input
                  type="text"
                  value={currentText(layout.yaxis?.title?.text)}
                  onChange={(e) => setAxisTitle("yaxis", e.target.value)}
                  className="border border-[color:var(--border)] rounded px-2 py-1 bg-white"
                />
              </label>
            )}
          </div>

          {/* Per-trace controls */}
          <div className="space-y-1.5">
            <span className="text-[color:var(--muted)] block">Series</span>
            {traces.map((t, i) => {
              const opts = typeOptions(t);
              const isScatter = String(t.type) === "scatter";
              const markerColor = t.marker?.color ?? t.line?.color;
              const colorVal = typeof markerColor === "string" ? markerColor : "#6366f1";
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 py-0.5">
                  <label className="flex items-center gap-1.5 min-w-[7rem]">
                    <input
                      type="checkbox"
                      checked={t.visible !== "legendonly" && t.visible !== false}
                      onChange={(e) => toggleVisible(i, e.target.checked)}
                    />
                    <span className="truncate max-w-[8rem]" title={String(t.name ?? `Trace ${i + 1}`)}>
                      {String(t.name ?? `Trace ${i + 1}`)}
                    </span>
                  </label>

                  {opts.length > 0 && (
                    <select
                      value={String(t.type)}
                      onChange={(e) => changeType(i, e.target.value)}
                      className="border border-[color:var(--border)] rounded px-1.5 py-0.5 bg-white"
                    >
                      {opts.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  )}

                  {isScatter && (
                    <select
                      value={String(t.mode ?? "markers")}
                      onChange={(e) => patchTrace(i, (tr) => { tr.mode = e.target.value; })}
                      className="border border-[color:var(--border)] rounded px-1.5 py-0.5 bg-white"
                    >
                      {SCATTER_MODES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )}

                  {colorEditable(t) && (
                    <input
                      type="color"
                      value={colorVal}
                      onChange={(e) => setTraceColor(i, e.target.value)}
                      className="w-6 h-6 p-0 border border-[color:var(--border)] rounded cursor-pointer"
                      title="Series color"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-[color:var(--muted)]">
            Changes affect this chart only. To plot different variables, adjust the analysis form and re-run.
          </p>
        </div>
      )}

      <div ref={containerRef} className="px-2 pb-2">
        <div style={{ maxWidth, marginInline: "auto" }}>
          <Plot
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data={(spec as any).data}
            layout={{
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...(spec as any).layout,
              autosize: true,
              // Respect a backend-provided margin (pie/radar/path diagrams need their own
              // spacing); otherwise fall back to cartesian-friendly defaults.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              margin: (spec as any).layout?.margin ?? { l: 50, r: 20, t: 40, b: 50 },
              font: { size: 11 },
            }}
            // Height tracks the chosen width (~0.62 aspect) so charts stay tidy rather than
            // short-and-wide, with a floor so very narrow widths remain legible.
            style={{ width: "100%", height: Math.max(280, Math.round(maxWidth * 0.62)) }}
            useResizeHandler
            config={{
              responsive: true,
              displayModeBar: "hover",
              displaylogo: false,
              modeBarButtonsToRemove: ["lasso2d", "select2d"],
            }}
          />
        </div>
      </div>
    </div>
  );
}
