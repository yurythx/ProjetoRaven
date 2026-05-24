import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { backendFetch } from "@/lib/backend";
import { getAccessToken } from "@/lib/auth-cookies";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const target = `/api/forum/public/topics/${qs ? `?${qs}` : ""}`;

  const result = await backendFetch(target, {
    method: "GET",
    cache: "no-store",
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
  const result = await backendFetch("/api/forum/topics/", {
    method: "POST",
    json: payload,
    accessToken: access,
  });

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  revalidateTag("forum:topics");
  revalidateTag("forum:categories");

  return NextResponse.json(result.data);
}
