import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const isDev = process.env.NODE_ENV === "development";

// Internal Docker service name — Next.js image optimizer and schema proxy use this
const INTERNAL_MEDIA_ORIGIN = "http://django:8000";
const INTERNAL_API_ORIGIN = process.env.INTERNAL_API_BASE_URL || process.env.API_BASE_URL || "http://django:8000";

function tryParseRemotePatternFromEnv(): { protocol: "http" | "https"; hostname: string; port?: string; pathname: string } | null {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const protocol = u.protocol.replace(":", "");
    if (protocol !== "http" && protocol !== "https") return null;
    return {
      protocol,
      hostname: u.hostname,
      port: u.port || undefined,
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

// ── Security headers ──────────────────────────────────────────────────────────
// CSP is intentionally omitted here — it is set at runtime in src/middleware.ts
// so that env vars (e.g. NEXT_PUBLIC_WS_BASE_URL) are read from the running
// container rather than being baked in at build time.
const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Allow same-origin embedding (needed for blog preview dialog) — CSP frame-ancestors 'self' handles modern browsers
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Disable legacy XSS filter — modern browsers use CSP instead
  { key: "X-XSS-Protection", value: "0" },
  // Referrer: send origin only on same-origin, bare origin on cross-origin HTTPS
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features the app doesn't use
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HSTS — only in production (HTTP dev server would break)
  ...(!isDev
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

// ─────────────────────────────────────────────────────────────────────────────

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "django", port: "8000", pathname: "/**" },
      { protocol: "https", hostname: "django", port: "8000", pathname: "/**" },
      { protocol: "https", hostname: "projetoraven.com", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8006", pathname: "/**" },
      { protocol: "http", hostname: "localhost", port: "8006", pathname: "/**" },
      { protocol: "http", hostname: "localhost", pathname: "/**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/media/:path*",
        destination: `${INTERNAL_MEDIA_ORIGIN}/media/:path*`,
      },
      {
        source: "/api/schema/:path*",
        destination: `${INTERNAL_API_ORIGIN}/api/schema/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  output: "standalone",
};

const envPattern = tryParseRemotePatternFromEnv();
if (envPattern) {
  const patterns = nextConfig.images?.remotePatterns ?? [];
  const exists = patterns.some(
    (p) =>
      p.protocol === envPattern.protocol &&
      p.hostname === envPattern.hostname &&
      (p.port ?? "") === (envPattern.port ?? "")
  );
  if (!exists) patterns.push(envPattern);
  if (nextConfig.images) nextConfig.images.remotePatterns = patterns;
}

export default withBundleAnalyzer(nextConfig);
