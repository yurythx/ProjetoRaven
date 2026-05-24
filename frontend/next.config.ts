import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const isDev = process.env.NODE_ENV === "development";

// Internal Docker service name — Next.js image optimizer and schema proxy use this
const INTERNAL_MEDIA_ORIGIN = "http://django:8000";
const INTERNAL_API_ORIGIN = process.env.INTERNAL_API_BASE_URL || process.env.API_BASE_URL || "http://django:8000";

// Public-facing API origin for CSP img-src (media files served by Django)
function getApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

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
//
// CSP notes:
//   script-src  'unsafe-inline' — Next.js App Router injects inline hydration
//               scripts that cannot be removed without nonces (future work).
//               'unsafe-eval' is added only in dev (react-refresh hot-loader).
//   style-src   'unsafe-inline' — Next.js injects critical CSS as inline <style>.
//   img-src     includes the API origin so unoptimized <Image> tags that point
//               to Django media files load correctly.
//   connect-src 'self' covers all fetch() calls going through /api/* proxy.
//
function buildCsp(): string {
  const apiOrigin = getApiOrigin();
  const extraImg = apiOrigin ? ` ${apiOrigin}` : "";
  const extraScript = isDev ? " 'unsafe-eval'" : "";

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${extraScript}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${extraImg}`,
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(!isDev ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow embedding this site in iframes (reinforced by CSP frame-ancestors)
  { key: "X-Frame-Options", value: "DENY" },
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
  { key: "Content-Security-Policy", value: buildCsp() },
];

// ─────────────────────────────────────────────────────────────────────────────

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "django", port: "8000", pathname: "/**" },
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
