import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { getAccessToken } from "@/lib/auth-cookies";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { slug } = await params;
  const body = await req.json();
  const result = await backendFetch(`/api/v1/forum/categories/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    accessToken: access,
    json: body,
  });
  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { slug } = await params;
  const result = await backendFetch(`/api/v1/forum/categories/${encodeURIComponent(slug)}/`, {
    method: "DELETE",
    accessToken: access,
  });
  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return new NextResponse(null, { status: 204 });
}
