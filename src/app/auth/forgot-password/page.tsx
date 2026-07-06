import type { Metadata } from "next";
import ForgotPasswordClient from "./ForgotPasswordClient";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a password reset link for your Neurogauge account.",
  robots: { index: false },
};

export default function Page() {
  return <ForgotPasswordClient />;
}
