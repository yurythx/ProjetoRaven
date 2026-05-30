import { NextResponse, type NextRequest } from "next/server";

import { getApiBaseUrl, isProd } from "@/lib/env";

type MeResponse = {
  is_admin?: boolean;
  is_blog_editor?: boolean;
  is_forum_moderator?: boolean;
};

// Computed once at module load — env vars are fixed for the lifetime of the process.
// Keeping it here (runtime) rather than next.config.ts (build time) means
// NEXT_PUBLIC_WS_BASE_URL and NEXT_PUBLIC_API_BASE_URL are read from the
// container environment, not baked in during docker build.
const CSP_HEADER = (() => {
  const dev = process.env.NODE_ENV !== "production";

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  let apiOrigin = "";
  try {
    if (apiBaseUrl) apiOrigin = new URL(apiBaseUrl).origin;
  } catch {}

  const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL || "";
  const connectExtra = dev
    ? " ws://localhost:8000 ws://django:8000"
    : wsUrl
      ? ` ${wsUrl}`
      : "";

  const extraImg = apiOrigin ? ` ${apiOrigin}` : "";
  const extraScript = dev ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com${extraScript}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: http://django:8000 https://django:8000${extraImg}`,
    "font-src 'self'",
    `connect-src 'self' https://cloudflareinsights.com${connectExtra}`,
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
})();

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

function withCsp(res: NextResponse): NextResponse {
  res.headers.set("Content-Security-Policy", CSP_HEADER);
  return res;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isBlogEditorRoute =
    path === "/blog/novo" ||
    path === "/blog/comentarios" ||
    /^\/blog\/[^/]+\/editar$/.test(path);

  if (isBlogEditorRoute) {
    const access = req.cookies.get("raven_access")?.value ?? null;
    const refresh = req.cookies.get("raven_refresh")?.value ?? null;
    if (!access && !refresh) return withCsp(NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url)));

    let nextAccess = access;
    let me: MeResponse | null = null;

    if (nextAccess) {
      const meRes = await fetchMe(nextAccess);
      if (meRes.ok) {
        me = (await meRes.json().catch(() => null)) as MeResponse | null;
      } else if (meRes.status === 401 && refresh) {
        nextAccess = null;
      } else {
        return withCsp(NextResponse.redirect(new URL("/blog", req.url)));
      }
    }

    if (!me && refresh) {
      const r = await refreshAccess(refresh);
      if (!r.ok) return withCsp(NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url)));
      const body = (await r.json().catch(() => null)) as { access?: unknown } | null;
      const newAccess = body && typeof body.access === "string" ? body.access : null;
      if (!newAccess) return withCsp(NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url)));
      nextAccess = newAccess;
      const meRes2 = await fetchMe(newAccess);
      if (!meRes2.ok) return withCsp(NextResponse.redirect(new URL("/blog", req.url)));
      me = (await meRes2.json().catch(() => null)) as MeResponse | null;

      if (!me?.is_admin && !me?.is_blog_editor) return withCsp(NextResponse.redirect(new URL("/blog", req.url)));
      const res = NextResponse.next();
      res.cookies.set("raven_access", newAccess, { httpOnly: true, secure: isProd(), sameSite: "lax", path: "/" });
      return withCsp(res);
    }

    if (!me?.is_admin && !me?.is_blog_editor) return withCsp(NextResponse.redirect(new URL("/blog", req.url)));
    return withCsp(NextResponse.next());
  }

  const needsAdmin = path.startsWith("/dashboard");
  const needsStrictAdmin = path.startsWith("/dashboard/usuarios");
  const needsAuth = needsAdmin || path.startsWith("/forum/new") || path === "/me";
  if (!needsAuth) return withCsp(NextResponse.next());

  const access = req.cookies.get("raven_access")?.value ?? null;
  const refresh = req.cookies.get("raven_refresh")?.value ?? null;
  if (!access && !refresh) return withCsp(redirectToLogin(req));

  const secure = isProd();
  let nextAccess = access;
  let me: MeResponse | null = null;

  if (nextAccess) {
    const meRes = await fetchMe(nextAccess);
    if (meRes.ok) {
      me = (await meRes.json().catch(() => null)) as MeResponse | null;
    } else if (meRes.status === 401 && refresh) {
      nextAccess = null;
    } else {
      return withCsp(redirectToLogin(req));
    }
  }

  if (!me && refresh) {
    const r = await refreshAccess(refresh);
    if (!r.ok) return withCsp(redirectToLogin(req));
    const body = (await r.json().catch(() => null)) as { access?: unknown } | null;
    const newAccess = body && typeof body.access === "string" ? body.access : null;
    if (!newAccess) return withCsp(redirectToLogin(req));

    nextAccess = newAccess;
    const meRes2 = await fetchMe(newAccess);
    if (!meRes2.ok) return withCsp(redirectToLogin(req));
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
    const res = allowed ? NextResponse.next() : NextResponse.redirect(new URL("/blog", req.url));
    res.cookies.set("raven_access", newAccess, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
    });
    return withCsp(res);
  }

  if (!me) return withCsp(redirectToLogin(req));
  const isDashboardRoot = path === "/dashboard";
  const isBlogArea = path.startsWith("/dashboard/blog");
  const isForumArea = path.startsWith("/dashboard/forum");
  if (needsStrictAdmin && !me.is_admin) return withCsp(NextResponse.redirect(new URL("/blog", req.url)));
  if (isBlogArea && !me.is_admin && !me.is_blog_editor) return withCsp(NextResponse.redirect(new URL("/blog", req.url)));
  if (isForumArea && !me.is_admin && !me.is_forum_moderator) return withCsp(NextResponse.redirect(new URL("/blog", req.url)));
  if (isDashboardRoot && !me.is_admin && !me.is_blog_editor && !me.is_forum_moderator) return withCsp(NextResponse.redirect(new URL("/blog", req.url)));
  if (needsAdmin && !me.is_admin && !me.is_blog_editor && !me.is_forum_moderator) return withCsp(NextResponse.redirect(new URL("/blog", req.url)));
  return withCsp(NextResponse.next());
}

export const config = {
  // Match all routes except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
