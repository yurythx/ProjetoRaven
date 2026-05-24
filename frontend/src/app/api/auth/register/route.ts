import { NextResponse } from "next/server";

import { clearAuthCookies } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST(req: Request) {
  const payload = await req.json();

  const result = await backendFetch<{ verification_required: boolean; email: string }>("/api/v1/accounts/register/", {
    method: "POST",
    json: payload,
  });

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  await clearAuthCookies();
  return NextResponse.json({ verification_required: Boolean(result.data.verification_required), email: String(result.data.email || "") });
}
