import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: { absolute: "Neurogauge Neuroscience Lab — Cognitive Assessment Platform" },
  description:
    "Measure working memory with research-grade precision. N-back testing across Letters, Shapes, and Rotated-E with NASA-TLX questionnaires, d-prime scoring, and CSV export for researchers.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Neurogauge Neuroscience Lab",
  url: "https://www.neurogauge.africa",
  applicationCategory: "Research",
  description:
    "Research-grade N-back working memory assessment platform with NASA-TLX questionnaires, d-prime scoring, and CSV export.",
  publisher: {
    "@type": "Organization",
    name: "Neurogauge Neuroscience Lab",
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient />
    </>
  );
}
