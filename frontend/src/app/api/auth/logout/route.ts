import { NextResponse } from "next/server";

import { clearAuthCookies, getRefreshToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST() {
  const refresh = await getRefreshToken();
  if (refresh) {
    await backendFetch("/api/v1/accounts/logout/", { method: "POST", json: { refresh } });
  }

  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
