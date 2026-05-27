"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Download, ChevronDown } from "lucide-react";
import { downloadBlob, chartFilename } from "@/lib/analytics/download";

const Plot = dynamic(
  async () => {
    const [{ default: createPlotlyComponent }, Plotly] = await Promise.all([
      import("react-plotly.js/factory"),
      import("plotly.js-dist-min"),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createPlotlyComponent(Plotly as any);
  },
  { ssr: false }
);

interface ChartCardProps {
  analysisKey: string;
  plotType: string;
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout: Record<string, any>;
}

export function ChartCard({ analysisKey, plotType, index, data, layout }: ChartCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-chart-menu="${index}"]`)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen, index]);

  async function getPlotNode(): Promise<HTMLElement | null> {
    return containerRef.current?.querySelector(".js-plotly-plot") as HTMLElement | null;
  }

  async function downloadImage(format: "png" | "svg") {
    const node = await getPlotNode();
    if (!node) return;
    const Plotly = (await import("plotly.js-dist-min")).default as unknown as {
      downloadImage: (gd: HTMLElement, opts: Record<string, unknown>) => Promise<string>;
    };
    await Plotly.downloadImage(node, {
      format,
      filename: chartFilename(analysisKey, plotType, index, format).replace(/\.(png|svg)$/, ""),
      width: typeof layout.width === "number" ? layout.width : 1200,
      height: typeof layout.height === "number" ? layout.height : 600,
      ...(format === "png" ? { scale: 2 } : {}),
    });
    setMenuOpen(false);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify({ data, layout }, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, chartFilename(analysisKey, plotType, index, "json"));
    setMenuOpen(false);
  }

  return (
    <div className="card p-4">
      <div className="flex justify-end mb-2">
        <div className="relative" data-chart-menu={index}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="btn btn-ghost text-sm"
          >
            <Download className="w-4 h-4" /> Download
            <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-36 bg-white border border-[color:var(--border)] rounded-lg shadow-lg z-10 overflow-hidden">
              <button
                type="button"
                onClick={() => downloadImage("png")}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >PNG (2× scale)</button>
              <button
                type="button"
                onClick={() => downloadImage("svg")}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >SVG (vector)</button>
              <button
                type="button"
                onClick={downloadJson}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >Plotly JSON</button>
            </div>
          )}
        </div>
      </div>
      <div ref={containerRef}>
        <Plot
          data={data as unknown as Plotly.Data[]}
          layout={{ ...layout, autosize: true } as Partial<Plotly.Layout>}
          style={{ width: "100%", height: 380 }}
          useResizeHandler
          config={{ displayModeBar: false, responsive: true }}
        />
      </div>
    </div>
  );
}
