import { NextResponse } from "next/server";

import { setAuthCookies } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST(req: Request) {
  const { totp_token, code } = await req.json();

  const result = await backendFetch<{
    user: unknown;
    tokens: { access: string; refresh: string };
  }>("/api/v1/accounts/2fa/verify/", { method: "POST", json: { totp_token, code } });

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  await setAuthCookies(result.data.tokens.access, result.data.tokens.refresh);
  return NextResponse.json({ user: result.data.user });
}
