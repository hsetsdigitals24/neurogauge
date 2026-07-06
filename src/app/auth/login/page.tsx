import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your Neurogauge researcher account to manage N-back studies, participants, and results.",
};

export default function Page() {
  return <LoginClient />;
}
