export function getApiBaseUrl() {
  const normalize = (url: string) => url.replace(/\/+$/, "").replace(/\/api$/, "");

  if (typeof window === "undefined") {
    const url = process.env.API_BASE_URL || process.env.INTERNAL_API_BASE_URL || "http://localhost:8000";
    return normalize(url);
  }

  const url = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  return normalize(url);
}

export function getSiteBaseUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  return "http://localhost:3000";
}

export function isProd() {
  return process.env.NODE_ENV === "production";
}
