import { NextResponse } from "next/server";

import { setAuthCookies } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

type LoginResponse =
  | { user: unknown; tokens: { access: string; refresh: string } }
  | { totp_required: true; totp_token: string };

export async function POST(req: Request) {
  const payload = await req.json();

  const result = await backendFetch<LoginResponse>("/api/v1/accounts/login/", {
    method: "POST",
    json: payload,
  });

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  if ("totp_required" in result.data && result.data.totp_required) {
    return NextResponse.json({ totp_required: true, totp_token: result.data.totp_token });
  }

  const data = result.data as { user: unknown; tokens: { access: string; refresh: string } };
  await setAuthCookies(data.tokens.access, data.tokens.refresh);
  return NextResponse.json({ user: data.user });
}
