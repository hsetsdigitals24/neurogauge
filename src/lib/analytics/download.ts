export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function chartFilename(
  analysisKey: string,
  plotType: string,
  index: number,
  ext: "png" | "svg" | "json",
): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  const today = new Date().toISOString().slice(0, 10);
  return `${safe(analysisKey)}_${safe(plotType)}_${today}_${index}.${ext}`;
}
