import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: { absolute: "Neurogauge — The End-to-End Research Platform" },
  description:
    "One platform for the entire research lifecycle: cognitive assessment, an SPSS-style statistical analytics workbench, expert consulting and certified training — built for researchers.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Neurogauge Neuroscience Lab",
  url: "https://www.neurogauge.africa",
  applicationCategory: "Research",
  description:
    "End-to-end research platform: cognitive assessment, statistical analytics workbench, expert consulting and certified training.",
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
