import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/backend";

export async function POST(req: Request) {
  const payload = await req.json();
  const result = await backendFetch("/api/v1/accounts/password-reset/", { method: "POST", json: payload });
  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }
  return NextResponse.json({ ok: true });
}

