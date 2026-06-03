import { NextRequest, NextResponse } from "next/server";

function getInternalApiBaseUrl() {
  const normalize = (url: string) => url.replace(/\/+$/, "").replace(/\/api$/, "");
  const url = process.env.INTERNAL_API_BASE_URL || process.env.API_BASE_URL || "http://localhost:8000";
  return normalize(url);
}

async function fetchWithRetry(input: URL, init: RequestInit, retries: number) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastError = err;
      if (attempt >= retries) break;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const baseUrl = getInternalApiBaseUrl();

  const upstreamUrl = new URL(`${baseUrl}/media/${path.map(encodeURIComponent).join("/")}`);
  upstreamUrl.search = request.nextUrl.search;

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);
  const ifModifiedSince = request.headers.get("if-modified-since");
  if (ifModifiedSince) headers.set("if-modified-since", ifModifiedSince);
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) headers.set("if-none-match", ifNoneMatch);

  const res = await fetchWithRetry(upstreamUrl, { method: "GET", headers, cache: "no-store" }, 2);

  const outHeaders = new Headers(res.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("transfer-encoding");
  outHeaders.delete("connection");
  outHeaders.set("x-raven-media-proxy", "1");

  return new NextResponse(res.body, { status: res.status, headers: outHeaders });
}

export async function HEAD(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const baseUrl = getInternalApiBaseUrl();

  const upstreamUrl = new URL(`${baseUrl}/media/${path.map(encodeURIComponent).join("/")}`);
  upstreamUrl.search = request.nextUrl.search;

  const res = await fetchWithRetry(upstreamUrl, { method: "HEAD", cache: "no-store" }, 2);
  const outHeaders = new Headers(res.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("transfer-encoding");
  outHeaders.delete("connection");
  outHeaders.set("x-raven-media-proxy", "1");
  return new NextResponse(null, { status: res.status, headers: outHeaders });
}
