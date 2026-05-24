import { NextResponse } from "next/server";

import { getRefreshToken, setAuthCookies } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST() {
  const refresh = await getRefreshToken();
  if (!refresh) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await backendFetch<{ access: string; refresh?: string }>(
    "/api/v1/accounts/token/refresh/",
    { method: "POST", json: { refresh } }
  );

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  await setAuthCookies(result.data.access, result.data.refresh ?? refresh);
  return NextResponse.json({ ok: true });
}
