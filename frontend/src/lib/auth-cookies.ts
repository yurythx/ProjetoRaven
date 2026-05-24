import { cookies } from "next/headers";

import { isProd } from "@/lib/env";

const ACCESS_COOKIE = "raven_access";
const REFRESH_COOKIE = "raven_refresh";

export async function setAuthCookies(access: string, refresh: string) {
  const jar = await cookies();
  // COOKIE_SECURE is a runtime-only server env var (no NEXT_PUBLIC_ prefix).
  // Set to "false" in .env.prod when testing locally over HTTP.
  // Defaults to auto-detect: true when NODE_ENV=production AND NEXT_PUBLIC_SITE_URL starts with https://.
  const cookieSecureProp = process.env.COOKIE_SECURE;
  let secure: boolean;
  if (cookieSecureProp !== undefined) {
    secure = cookieSecureProp.toLowerCase() === "true";
  } else {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const isHttps = Boolean(siteUrl?.startsWith("https://")) || Boolean(process.env.VERCEL_URL);
    secure = isProd() && isHttps;
  }

  jar.set(ACCESS_COOKIE, access, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });

  jar.set(REFRESH_COOKIE, refresh, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function clearAccessCookie() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
}

export async function getAccessToken() {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken() {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}
