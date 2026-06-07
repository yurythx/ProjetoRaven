import { NextResponse, type NextRequest } from "next/server";

import { getApiBaseUrl, isProd } from "@/lib/env";

type MeResponse = {
  is_admin?: boolean;
  is_blog_editor?: boolean;
  is_forum_moderator?: boolean;
};

function toWsProtocol(proto: string): string {
  return proto === "https:" ? "wss:" : proto === "http:" ? "ws:" : proto;
}

function buildCspHeader(nonce: string, opts: { upgradeInsecureRequests: boolean }): string {
  const dev = process.env.NODE_ENV !== "production";

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  let apiOrigin = "";
  try {
    if (apiBaseUrl) apiOrigin = new URL(apiBaseUrl).origin;
  } catch {}

  const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL || "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  const connectSrcParts = new Set<string>(["'self'", "https://cloudflareinsights.com"]);
  const addWsOrigin = (raw: string) => {
    if (!raw) return;
    try {
      const u = new URL(raw);
      connectSrcParts.add(`${toWsProtocol(u.protocol)}//${u.host}`);
    } catch {}
  };

  if (dev) {
    ["ws://localhost:8000", "ws://django:8000", "ws://localhost:8006", "ws://127.0.0.1:8006"].forEach((s) =>
      connectSrcParts.add(s)
    );
  } else {
    addWsOrigin(siteUrl);
    addWsOrigin(apiBaseUrl);
    addWsOrigin(wsUrl);
  }

  const extraImg = apiOrigin ? ` ${apiOrigin}` : "";
  const extraScript = dev ? " 'unsafe-eval'" : "";
  const styleSrc = dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'unsafe-inline'`;
  const styleSrcAttr = "style-src-attr 'unsafe-inline'";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com${extraScript}`,
    "script-src-attr 'none'",
    styleSrc,
    styleSrcAttr,
    `img-src 'self' data: blob:${dev ? " http://django:8000 https://django:8000" : ""}${extraImg}`,
    "font-src 'self'",
    `connect-src ${Array.from(connectSrcParts).join(" ")}`,
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.loom.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev || !opts.upgradeInsecureRequests ? [] : ["upgrade-insecure-requests", "block-all-mixed-content"]),
  ].join("; ");
}

async function fetchMe(accessToken: string) {
  const baseUrl = getApiBaseUrl();
  return fetch(`${baseUrl}/api/v1/accounts/me/`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
}

async function refreshAccess(refreshToken: string) {
  const baseUrl = getApiBaseUrl();
  return fetch(`${baseUrl}/api/v1/accounts/token/refresh/`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
    cache: "no-store",
  });
}

function redirectToLogin(req: NextRequest) {
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  const res = NextResponse.redirect(url);
  res.cookies.delete("raven_access");
  res.cookies.delete("raven_refresh");
  return res;
}

function withCsp(res: NextResponse, cspHeader: string, nonce: string): NextResponse {
  res.headers.set("Content-Security-Policy", cspHeader);
  res.headers.set("x-nonce", nonce);
  return res;
}

function computeCookieSecure(): boolean {
  const cookieSecureProp = process.env.COOKIE_SECURE;
  if (cookieSecureProp !== undefined) {
    return cookieSecureProp.toLowerCase() === "true";
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const isHttps = Boolean(siteUrl?.startsWith("https://")) || Boolean(process.env.VERCEL_URL);
  return isProd() && isHttps;
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const nonce = generateNonce();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const isHttps = req.nextUrl.protocol === "https:" || siteUrl.startsWith("https://");
  const cspHeader = buildCspHeader(nonce, { upgradeInsecureRequests: isHttps });
  const requestHeaders = new Headers(req.headers);
  const upstreamRequestId = (req.headers.get("x-request-id") || "").trim();
  const requestId = upstreamRequestId || crypto.randomUUID();
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const addRid = (res: NextResponse) => {
    res.headers.set("x-request-id", requestId);
    return res;
  };

  const next = () => addRid(withCsp(NextResponse.next({ request: { headers: requestHeaders } }), cspHeader, nonce));
  const redirect = (url: URL) => addRid(withCsp(NextResponse.redirect(url), cspHeader, nonce));
  const apply = (res: NextResponse) => addRid(withCsp(res, cspHeader, nonce));

  const isBlogEditorRoute =
    path === "/blog/novo" ||
    path === "/blog/comentarios" ||
    /^\/blog\/[^/]+\/editar$/.test(path);

  if (isBlogEditorRoute) {
    const access = req.cookies.get("raven_access")?.value ?? null;
    const refresh = req.cookies.get("raven_refresh")?.value ?? null;
    if (!access && !refresh) return redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url));

    let nextAccess = access;
    let me: MeResponse | null = null;

    if (nextAccess) {
      const meRes = await fetchMe(nextAccess);
      if (meRes.ok) {
        me = (await meRes.json().catch(() => null)) as MeResponse | null;
      } else if (meRes.status === 401 && refresh) {
        nextAccess = null;
      } else {
        return redirect(new URL("/blog", req.url));
      }
    }

    if (!me && refresh) {
      const r = await refreshAccess(refresh);
      if (!r.ok) return redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url));
      const body = (await r.json().catch(() => null)) as { access?: unknown } | null;
      const newAccess = body && typeof body.access === "string" ? body.access : null;
      if (!newAccess) return redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url));
      nextAccess = newAccess;
      const meRes2 = await fetchMe(newAccess);
      if (!meRes2.ok) return redirect(new URL("/blog", req.url));
      me = (await meRes2.json().catch(() => null)) as MeResponse | null;

      if (!me?.is_admin && !me?.is_blog_editor) return redirect(new URL("/blog", req.url));
      const res = next();
      res.cookies.set("raven_access", newAccess, { httpOnly: true, secure: computeCookieSecure(), sameSite: "lax", path: "/" });
      return res;
    }

    if (!me?.is_admin && !me?.is_blog_editor) return redirect(new URL("/blog", req.url));
    return next();
  }

  const needsAdmin = path.startsWith("/dashboard");
  const needsStrictAdmin = path.startsWith("/dashboard/usuarios");
  const needsAuth = needsAdmin || path.startsWith("/forum/new") || path === "/me";
  if (!needsAuth) return next();

  const access = req.cookies.get("raven_access")?.value ?? null;
  const refresh = req.cookies.get("raven_refresh")?.value ?? null;
  if (!access && !refresh) return apply(redirectToLogin(req));

  const secure = computeCookieSecure();
  let nextAccess = access;
  let me: MeResponse | null = null;

  if (nextAccess) {
    const meRes = await fetchMe(nextAccess);
    if (meRes.ok) {
      me = (await meRes.json().catch(() => null)) as MeResponse | null;
    } else if (meRes.status === 401 && refresh) {
      nextAccess = null;
    } else {
      return apply(redirectToLogin(req));
    }
  }

  if (!me && refresh) {
    const r = await refreshAccess(refresh);
    if (!r.ok) return apply(redirectToLogin(req));
    const body = (await r.json().catch(() => null)) as { access?: unknown } | null;
    const newAccess = body && typeof body.access === "string" ? body.access : null;
    if (!newAccess) return apply(redirectToLogin(req));

    nextAccess = newAccess;
    const meRes2 = await fetchMe(newAccess);
    if (!meRes2.ok) return apply(redirectToLogin(req));
    me = (await meRes2.json().catch(() => null)) as MeResponse | null;

    const isDashboardRoot = path === "/dashboard";
    const isBlogArea = path.startsWith("/dashboard/blog");
    const isForumArea = path.startsWith("/dashboard/forum");

    const allowed = needsStrictAdmin
      ? Boolean(me?.is_admin)
      : isBlogArea
        ? Boolean(me?.is_admin || me?.is_blog_editor)
        : isForumArea
          ? Boolean(me?.is_admin || me?.is_forum_moderator)
          : isDashboardRoot
            ? Boolean(me?.is_admin || me?.is_blog_editor || me?.is_forum_moderator)
            : Boolean(me?.is_admin);
    const res = allowed ? next() : redirect(new URL("/blog", req.url));
    res.cookies.set("raven_access", newAccess, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
    });
    return res;
  }

  if (!me) return apply(redirectToLogin(req));
  const isDashboardRoot = path === "/dashboard";
  const isBlogArea = path.startsWith("/dashboard/blog");
  const isForumArea = path.startsWith("/dashboard/forum");
  if (needsStrictAdmin && !me.is_admin) return redirect(new URL("/blog", req.url));
  if (isBlogArea && !me.is_admin && !me.is_blog_editor) return redirect(new URL("/blog", req.url));
  if (isForumArea && !me.is_admin && !me.is_forum_moderator) return redirect(new URL("/blog", req.url));
  if (isDashboardRoot && !me.is_admin && !me.is_blog_editor && !me.is_forum_moderator) return redirect(new URL("/blog", req.url));
  if (needsAdmin && !me.is_admin && !me.is_blog_editor && !me.is_forum_moderator) return redirect(new URL("/blog", req.url));
  return next();
}

export const config = {
  // Match all routes except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
