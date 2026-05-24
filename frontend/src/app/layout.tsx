import type { Metadata, Viewport } from "next";
import { Exo_2, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { cookies } from "next/headers";
import { AppHeader } from "@/components/app-header";
import { AuthProvider } from "@/components/auth-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { PwaRegister } from "@/components/pwa-register";
import { QueryProvider } from "@/components/query-provider";
import { SonnerProvider } from "@/components/sonner-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as UiToaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/hooks/use-toast";
import { getSiteBaseUrl } from "@/lib/env";

const exo2 = Exo_2({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const viewport: Viewport = {
  themeColor: "#092e20",
};

const base = getSiteBaseUrl();
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const metadata: Metadata = {
  title: {
    template: "%s | Projeto Raven",
    default: "Projeto Raven — Blog & Fórum",
  },
  description: "Seu espaço para blog, discussões e comunidade. Explore artigos, participe do fórum e conecte-se.",
  metadataBase: new URL(base),
  openGraph: {
    title: "Projeto Raven — Blog & Fórum",
    description: "Seu espaço de blog e comunidade.",
    type: "website",
  },
  alternates: {
    types: {
      "application/rss+xml": `${apiBase}/api/v1/blog/rss/`,
      "application/atom+xml": `${apiBase}/api/v1/blog/atom/`,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("raven.theme")?.value;
  const dataTheme = themeCookie === "light" ? "light" : "dark";

  return (
    <html
      lang="pt-BR"
      data-theme={dataTheme}
      suppressHydrationWarning
      className={`${exo2.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <link rel="alternate" type="application/rss+xml" title="Projeto Raven — Blog" href="/rss.xml" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--rv-text-primary)] antialiased relative">
        <PwaRegister />
        {/* Global Ambient Background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div className="rv-orb rv-animate-pulse-glow" style={{ width: "900px", height: "900px", top: "-15%", right: "-12%", background: "var(--rv-accent)", opacity: 0.22 }} />
          <div className="rv-orb" style={{ width: "700px", height: "700px", bottom: "-15%", left: "-12%", background: "var(--rv-cyan)", opacity: 0.16 }} />
          <div className="rv-orb rv-animate-float" style={{ width: "400px", height: "400px", top: "35%", left: "40%", background: "var(--rv-accent-2)", opacity: 0.08 }} />
        </div>

        <ThemeProvider>
          <AuthProvider>
            <QueryProvider>
              <ToastProvider>
                <AppHeader />
                <main className="relative z-10 flex-1 pt-20">
                  <ErrorBoundary>{children}</ErrorBoundary>
                </main>
                <UiToaster />
                <SonnerProvider />
              </ToastProvider>
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
