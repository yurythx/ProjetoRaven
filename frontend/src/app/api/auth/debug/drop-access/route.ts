import { NextResponse } from "next/server";

import { clearAccessCookie, getRefreshToken } from "@/lib/auth-cookies";

async function drop() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await clearAccessCookie();
  const refresh = await getRefreshToken();
  return { ok: true, hasRefresh: Boolean(refresh) };
}

export async function GET() {
  const result = await drop();
  if (result instanceof NextResponse) return result;
  return new NextResponse(`ok=${result.ok} hasRefresh=${result.hasRefresh}`, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST() {
  const result = await drop();
  if (result instanceof NextResponse) return result;
  return NextResponse.json(result);
}
