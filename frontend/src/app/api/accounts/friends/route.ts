import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { getAccessToken } from "@/lib/auth-cookies";

export async function GET() {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const result = await backendFetch("/api/v1/accounts/friends/", {
    method: "GET",
    accessToken: access,
  });

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  return NextResponse.json(result.data);
}

export async function POST(request: NextRequest) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();

  const result = await backendFetch("/api/v1/accounts/friends/", {
    method: "POST",
    accessToken: access,
    body,
  });

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  return NextResponse.json(result.data, { status: 201 });
}
