import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { getAccessToken } from "@/lib/auth-cookies";

export async function POST(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const result = await backendFetch("/api/v1/accounts/delete-account/", {
    method: "POST",
    accessToken: token,
    json: body,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return new NextResponse(null, { status: 204 });
}
