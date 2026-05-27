"use client";
import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { downloadBlob } from "@/lib/analytics/download";

interface Props {
  filename: string;
  children: React.ReactNode;
}

export function ChartDownload({ filename, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-chart-dl]")) setOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  function getSvg(): SVGSVGElement | null {
    return containerRef.current?.querySelector("svg") ?? null;
  }

  function downloadSvg() {
    const svg = getSvg();
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([clone.outerHTML], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, `${filename}.svg`);
    setOpen(false);
  }

  function downloadPng() {
    const svg = getSvg();
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgBlob = new Blob([clone.outerHTML], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const vb = svg.viewBox.baseVal;
      const w = vb.width || svg.clientWidth || 480;
      const h = vb.height || svg.clientHeight || 240;
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${filename}.png`);
      }, "image/png");
    };
    img.src = url;
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      {children}
      <div className="absolute top-1 right-1" data-chart-dl>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="btn btn-ghost p-1 opacity-40 hover:opacity-100 transition-opacity"
          title="Download chart"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-28 bg-white border border-[color:var(--border)] rounded-lg shadow-lg z-10 overflow-hidden">
            <button type="button" onClick={downloadPng} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">
              PNG (2×)
            </button>
            <button type="button" onClick={downloadSvg} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">
              SVG
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
