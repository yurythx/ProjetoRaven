import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const redirect_uri = request.nextUrl.searchParams.get("redirect_uri") ?? "";

  if (!redirect_uri) {
    return NextResponse.json({ error: "redirect_uri required" }, { status: 400 });
  }

  const result = await backendFetch<{ auth_url: string; state: string }>(
    `/api/v1/accounts/oauth/${provider}/?redirect_uri=${encodeURIComponent(redirect_uri)}`,
    { method: "GET" }
  );

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  return NextResponse.json(result.data);
}
