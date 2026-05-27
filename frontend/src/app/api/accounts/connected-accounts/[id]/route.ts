import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ detail: "Não autenticado." }, { status: 401 });

  const result = await backendFetch(`/api/v1/accounts/oauth/connected/${encodeURIComponent(id)}/`, {
    method: "DELETE",
    accessToken: access,
    cache: "no-store",
  });

  if (!result.ok && result.error.status !== 204)
    return NextResponse.json(result.error.data, { status: result.error.status });
  return new NextResponse(null, { status: 204 });
}
