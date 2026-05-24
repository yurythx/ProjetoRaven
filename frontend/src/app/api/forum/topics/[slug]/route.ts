import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { backendFetch } from "@/lib/backend";
import { getAccessToken } from "@/lib/auth-cookies";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const target = `/api/forum/public/topics/${encodeURIComponent(slug)}/${qs ? `?${qs}` : ""}`;

  const result = await backendFetch(target, {
    method: "GET",
    cache: "no-store",
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { slug } = await params;
  const payload = await req.json().catch(() => ({}));

  const result = await backendFetch(`/api/forum/topics/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    json: payload,
    accessToken: access,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  revalidateTag("forum:topics");
  return NextResponse.json(result.data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { slug } = await params;

  const result = await backendFetch(`/api/forum/topics/${encodeURIComponent(slug)}/`, {
    method: "DELETE",
    accessToken: access,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  revalidateTag("forum:topics");
  return new NextResponse(null, { status: 204 });
}
