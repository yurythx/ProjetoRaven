import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const payload = await req.json().catch(() => ({}));

  const result = await backendFetch(`/api/forum/replies/${encodeURIComponent(id)}/`, {
    method: "PATCH",
    json: payload,
    accessToken: access,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  revalidateTag("forum:topics");
  return NextResponse.json(result.data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  const result = await backendFetch(`/api/forum/replies/${encodeURIComponent(id)}/`, {
    method: "DELETE",
    accessToken: access,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  revalidateTag("forum:topics");
  return new NextResponse(null, { status: 204 });
}

