import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { getAccessToken } from "@/lib/auth-cookies";
import { getApiBaseUrl } from "@/lib/env";

/**
 * Normalizes segments to match the Django backend structure (/blog/posts/, /blog/categories/, etc.)
 */
function getNormalizedTarget(baseUrl: string, segments: string[], qs: string) {
  const app = "blog";
  const rest = [...segments];

  // If first segment is 'articles' or 'posts', map to 'posts'
  if (rest[0] === "articles" || rest[0] === "posts") {
    rest[0] = "posts";
  }

  let path = rest.join("/");
  if (!path.endsWith("/")) path += "/";
  
  // Ensure we use the /api/v1/blog/ prefix
  return `${baseUrl}/api/v1/${app}/${path}${qs ? `?${qs}` : ""}`;
}

function isPublicReadPath(req: Request, segments: string[]) {
  const isRead = req.method === "GET" || req.method === "HEAD";
  if (segments[0] === "public") return isRead;
  if (!isRead) return false;

  // Categories and tags are usually public
  if (segments[0] === "categories" || segments[0] === "tags") return true;

  // List and detail are public if we use the public viewsets, 
  // but here we are proxying to the main set. 
  // We'll rely on the backend to enforce permissions if not explicitly 'public'.
  return false; 
}

async function proxy(req: Request, segments: string[]) {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  
  const target = getNormalizedTarget(baseUrl, segments, qs);

  const isPublic = isPublicReadPath(req, segments);
  const access = isPublic ? null : await getAccessToken();
  
  // We allow the request to proceed if it's public OR if we have an access token
  if (!isPublic && !access) {
    // If it's a GET request, we might want to try without auth anyway 
    // (Django will return 401/403 if it's strictly protected)
    if (req.method !== "GET") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
  }

  const headers = new Headers(req.headers);
  headers.delete("cookie");
  headers.delete("host");
  if (access) headers.set("Authorization", `Bearer ${access}`);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") ?? "application/json";
    const text = await res.text();

    // Cache invalidation on mutations
    const isMutation = req.method !== "GET" && req.method !== "HEAD";
    if (isMutation && res.ok) {
      revalidateTag("blog:posts");
      revalidateTag("blog:taxonomies");
    }

    return new NextResponse(text, { status: res.status, headers: { "content-type": contentType } });
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
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
