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
    // backendFetch returns status 500 with a string message for network errors (ECONNREFUSED etc.)
    // Use 503 in that case so clients can distinguish from a real Django 500.
    const isNetworkError = result.error.status === 500 && typeof result.error.data === "string";
    const httpStatus = isNetworkError ? 503 : result.error.status;
    const body = isNetworkError ? { error: "Service unavailable" } : result.error.data;
    return NextResponse.json(body, { status: httpStatus });
  }

  await setAuthCookies(result.data.access, result.data.refresh ?? refresh);
  return NextResponse.json({ ok: true });
}
