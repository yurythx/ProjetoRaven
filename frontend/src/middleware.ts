import { NextResponse, type NextRequest } from "next/server";

import { getApiBaseUrl, isProd } from "@/lib/env";

type MeResponse = {
  is_admin?: boolean;
  is_blog_editor?: boolean;
  is_forum_moderator?: boolean;
};

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

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isBlogEditorRoute =
    path === "/blog/novo" ||
    path === "/blog/comentarios" ||
    /^\/blog\/[^/]+\/editar$/.test(path);

  if (isBlogEditorRoute) {
    const access = req.cookies.get("raven_access")?.value ?? null;
    const refresh = req.cookies.get("raven_refresh")?.value ?? null;
    if (!access && !refresh) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url));

    let nextAccess = access;
    let me: MeResponse | null = null;

    if (nextAccess) {
      const meRes = await fetchMe(nextAccess);
      if (meRes.ok) {
        me = (await meRes.json().catch(() => null)) as MeResponse | null;
      } else if (meRes.status === 401 && refresh) {
        nextAccess = null;
      } else {
        return NextResponse.redirect(new URL("/blog", req.url));
      }
    }

    if (!me && refresh) {
      const r = await refreshAccess(refresh);
      if (!r.ok) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url));
      const body = (await r.json().catch(() => null)) as { access?: unknown } | null;
      const newAccess = body && typeof body.access === "string" ? body.access : null;
      if (!newAccess) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url));
      nextAccess = newAccess;
      const meRes2 = await fetchMe(newAccess);
      if (!meRes2.ok) return NextResponse.redirect(new URL("/blog", req.url));
      me = (await meRes2.json().catch(() => null)) as MeResponse | null;

      if (!me?.is_admin && !me?.is_blog_editor) return NextResponse.redirect(new URL("/blog", req.url));
      const res = NextResponse.next();
      res.cookies.set("raven_access", newAccess, { httpOnly: true, secure: isProd(), sameSite: "lax", path: "/" });
      return res;
    }

    if (!me?.is_admin && !me?.is_blog_editor) return NextResponse.redirect(new URL("/blog", req.url));
    return NextResponse.next();
  }

  const needsAdmin = path.startsWith("/dashboard");
  const needsStrictAdmin = path.startsWith("/dashboard/usuarios");
  const needsAuth = needsAdmin || path.startsWith("/forum/new") || path === "/me";
  if (!needsAuth) return NextResponse.next();

  const access = req.cookies.get("raven_access")?.value ?? null;
  const refresh = req.cookies.get("raven_refresh")?.value ?? null;
  if (!access && !refresh) return redirectToLogin(req);

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
      return redirectToLogin(req);
    }
  }

  if (!me && refresh) {
    const r = await refreshAccess(refresh);
    if (!r.ok) return redirectToLogin(req);
    const body = (await r.json().catch(() => null)) as { access?: unknown } | null;
    const newAccess = body && typeof body.access === "string" ? body.access : null;
    if (!newAccess) return redirectToLogin(req);

    nextAccess = newAccess;
    const meRes2 = await fetchMe(newAccess);
    if (!meRes2.ok) return redirectToLogin(req);
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
    return res;
  }

  if (!me) return redirectToLogin(req);
  const isDashboardRoot = path === "/dashboard";
  const isBlogArea = path.startsWith("/dashboard/blog");
  const isForumArea = path.startsWith("/dashboard/forum");
  if (needsStrictAdmin && !me.is_admin) return NextResponse.redirect(new URL("/blog", req.url));
  if (isBlogArea && !me.is_admin && !me.is_blog_editor) return NextResponse.redirect(new URL("/blog", req.url));
  if (isForumArea && !me.is_admin && !me.is_forum_moderator) return NextResponse.redirect(new URL("/blog", req.url));
  if (isDashboardRoot && !me.is_admin && !me.is_blog_editor && !me.is_forum_moderator) return NextResponse.redirect(new URL("/blog", req.url));
  if (needsAdmin && !me.is_admin && !me.is_blog_editor && !me.is_forum_moderator) return NextResponse.redirect(new URL("/blog", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/me", "/blog/novo", "/blog/comentarios", "/blog/:slug/editar", "/dashboard/:path*", "/forum/new/:path*"],
};
