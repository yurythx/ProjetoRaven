import { NextResponse } from "next/server";

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
  const target = `${baseUrl}/api/v1/accounts/${path}/${qs ? `?${qs}` : ""}`;

  const baseHeaders = new Headers(req.headers);
  baseHeaders.delete("cookie");
  baseHeaders.delete("host");

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = new TextEncoder().encode(JSON.stringify(await req.json().catch(() => null)));
      baseHeaders.set("content-type", "application/json");
    } else {
      body = await req.arrayBuffer();
    }
  }

  const doFetch = async (token: string) => {
    const headers = new Headers(baseHeaders);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(target, { method: req.method, headers, body, cache: "no-store" });
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
