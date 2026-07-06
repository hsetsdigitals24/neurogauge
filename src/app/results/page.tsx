import type { Metadata } from "next";
import ResultsClient from "./ResultsClient";

export const metadata: Metadata = {
  title: "Look up my results",
  description:
    "Retrieve your Neurogauge assessment results — N-back performance, accuracy, and reaction times — using the email you provided during the session.",
};

export default function Page() {
  return <ResultsClient />;
}
