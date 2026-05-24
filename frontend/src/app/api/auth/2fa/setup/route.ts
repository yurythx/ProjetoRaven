import { NextResponse } from "next/server";

import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST() {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ detail: "Não autenticado." }, { status: 401 });

  const result = await backendFetch<{ secret: string; uri: string; qr_code: string }>(
    "/api/v1/accounts/2fa/setup/",
    { method: "POST", accessToken: access }
  );

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
