import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic");
  const page = url.searchParams.get("page");
  const pageSize = url.searchParams.get("page_size");
  const includeHidden = url.searchParams.get("include_hidden");

  const params = new URLSearchParams();
  if (topic) params.set("topic", topic);
  if (page) params.set("page", page);
  if (pageSize) params.set("page_size", pageSize);
  if (includeHidden) params.set("include_hidden", includeHidden);

  const needsAuth = includeHidden === "1" || includeHidden === "true";
  const access = needsAuth ? await getAccessToken() : null;
  if (needsAuth && !access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const target = needsAuth ? `/api/forum/replies/?${params.toString()}` : `/api/forum/public/replies/?${params.toString()}`;
  const result = await backendFetch(target, {
    method: "GET",
    accessToken: access,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}

export async function POST(req: Request) {
  const access = await getAccessToken();
  if (!access) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await req.json();
  const result = await backendFetch("/api/forum/replies/", {
    method: "POST",
    json: payload,
    accessToken: access,
  });

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  revalidateTag("forum:topics");

  return NextResponse.json(result.data);
}
