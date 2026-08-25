import type { Metadata } from "next";
import ResultsClient from "./ResultsClient";

export const metadata: Metadata = {
  title: "Look up my results",
  description:
    "Retrieve your Neurogauge results — N-back performance and reaction times, or your questionnaire responses — using the email you provided during the session.",
};

export default function Page() {
  return <ResultsClient />;
}
