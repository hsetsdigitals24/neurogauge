"use client";
import { Toaster } from "sonner";

/**
 * Global toast host, mounted once in the root layout. Styled to match the app's
 * theme tokens (see globals.css). richColors gives success/error/warning their own
 * accent colors; we round corners to match .btn / .card.
 */
export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        style: { borderRadius: "0.75rem" },
      }}
    />
  );
}
