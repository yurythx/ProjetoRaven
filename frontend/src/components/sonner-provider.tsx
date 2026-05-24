"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/components/theme-provider";

export function SonnerProvider() {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      richColors
      theme={resolvedTheme}
      toastOptions={{
        style: {
          background: "var(--rv-surface)",
          border: "1px solid var(--rv-border)",
          color: "var(--rv-text-primary)",
          fontFamily: "var(--font-display)",
        },
      }}
    />
  );
}
