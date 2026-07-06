import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AppToaster } from "@/components/AppToaster";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.neurogauge.africa"),
  title: {
    default: "Neurogauge Neuroscience Lab — Cognitive Assessment Platform",
    template: "%s | Neurogauge",
  },
  description:
    "Research-grade N-back testing across Letters, Shapes, and Rotated-E with NASA-TLX questionnaires and CSV export.",
  openGraph: {
    type: "website",
    siteName: "Neurogauge Neuroscience Lab",
    url: "https://www.neurogauge.africa",
    // TODO: replace with a dedicated 1200×630 public/og.png
    images: [{ url: "/assets/Asset 2@4x-100.jpg" }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Header />
        {children}
        <Footer />
        <AppToaster />
      </body>
    </html>
  );
}
