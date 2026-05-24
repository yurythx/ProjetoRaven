import { NextResponse } from "next/server";

import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const postSlug = url.searchParams.get("post_slug");
  const post = url.searchParams.get("post");

  const params = new URLSearchParams();
  if (postSlug) params.set("post_slug", postSlug);
  if (post) params.set("post", post);

  const result = await backendFetch(`/api/blog/public/comments/?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}

export async function POST(req: Request) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const payload = await req.json().catch(() => null);

  const result = await backendFetch("/api/blog/public/comments/", {
    method: "POST",
    json: payload ?? {},
    accessToken: access,
    cache: "no-store",
  });
  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data, { status: 201 });
}
