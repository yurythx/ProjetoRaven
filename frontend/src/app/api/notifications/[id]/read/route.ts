import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const result = await backendFetch<{ ok: boolean }>(
    `/api/v1/notifications/${encodeURIComponent(id)}/read/`,
    { method: "POST", accessToken: access, json: {} }
  );

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}
