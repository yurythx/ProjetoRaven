import { NextResponse } from "next/server";

import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST(req: Request) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ detail: "Não autenticado." }, { status: 401 });

  const { code } = await req.json();

  const result = await backendFetch<{ detail: string }>(
    "/api/v1/accounts/2fa/disable/",
    { method: "POST", json: { code }, accessToken: access }
  );

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
