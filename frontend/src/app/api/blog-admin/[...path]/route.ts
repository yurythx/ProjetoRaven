import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";
import { getApiBaseUrl } from "@/lib/env";

async function proxy(req: Request, segments: string[]) {
  let access = await getAccessToken();
  if (!access) {
    const refresh = await getRefreshToken();
    if (refresh) {
      const refreshed = await backendFetch<{ access: string; refresh?: string }>(
        "/api/v1/accounts/token/refresh/",
        { method: "POST", json: { refresh } }
      );
      if (refreshed.ok) {
        access = refreshed.data.access;
        await setAuthCookies(access, refreshed.data.refresh ?? refresh);
      }
    }
  }
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const path = segments.map((s) => encodeURIComponent(s)).join("/");
  const target = `${baseUrl}/api/v1/blog/${path}/${qs ? `?${qs}` : ""}`;

  const baseHeaders = new Headers(req.headers);
  baseHeaders.delete("cookie");
  baseHeaders.delete("host");

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (json) {
        if (json.image === "" || json.image === null) delete json.image;
        body = new TextEncoder().encode(JSON.stringify(json));
        baseHeaders.set("content-type", "application/json");
      } else {
        body = await req.arrayBuffer().catch(() => undefined);
      }
    } else {
      body = await req.arrayBuffer().catch(() => undefined);
    }
  }

  const doFetch = async (token: string) => {
    const headers = new Headers(baseHeaders);
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });
  };

  let res = await doFetch(access);

  if (res.status === 401) {
    const refresh = await getRefreshToken();
    if (refresh) {
      const refreshed = await backendFetch<{ access: string; refresh?: string }>(
        "/api/v1/accounts/token/refresh/",
        { method: "POST", json: { refresh } }
      );

      if (refreshed.ok) {
        access = refreshed.data.access;
        await setAuthCookies(access, refreshed.data.refresh ?? refresh);
        res = await doFetch(access);
      }
    }
  }

  const contentType = res.headers.get("content-type") ?? "application/json";
  const text = await res.text();

  const isMutation = req.method !== "GET" && req.method !== "HEAD";
  if (isMutation && res.ok) {
    const root = segments[0] ?? "";
    if (root === "posts" || root === "articles") {
      revalidateTag("blog:posts");
      const maybeSlug = segments[1];
      if (maybeSlug) revalidateTag(`blog:post:${maybeSlug}`);
    }
    if (root === "categories") {
      revalidateTag("blog:taxonomies");
      revalidateTag("blog:categories");
    }
    if (root === "tags") {
      revalidateTag("blog:taxonomies");
      revalidateTag("blog:tags");
    }
  }

  return new NextResponse(text, { status: res.status, headers: { "content-type": contentType } });
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PUT(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

