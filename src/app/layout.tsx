import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "N-Back Lab — Cognitive Assessment Platform",
  description:
    "Research-grade N-back testing across Letters, Shapes, and Rotated-E with NASA-TLX questionnaires and CSV export.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
