import type { Metadata } from "next";
import SignupClient from "./SignupClient";

export const metadata: Metadata = {
  title: "Create a researcher account",
  description:
    "Create a free Neurogauge account to run research-grade N-back working memory studies with NASA-TLX questionnaires and CSV export.",
};

export default function Page() {
  return <SignupClient />;
}
