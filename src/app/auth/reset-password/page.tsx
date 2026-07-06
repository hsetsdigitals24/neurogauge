import type { Metadata } from "next";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your Neurogauge account.",
  robots: { index: false },
};

export default function Page() {
  return <ResetPasswordClient />;
}
