import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function GET() {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ detail: "Não autenticado." }, { status: 401 });

  const result = await backendFetch<unknown[]>("/api/v1/accounts/oauth/connected/", {
    method: "GET",
    accessToken: access,
    cache: "no-store",
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}
