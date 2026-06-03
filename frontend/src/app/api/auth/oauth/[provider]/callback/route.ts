import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { setAuthCookies } from "@/lib/auth-cookies";

type OAuthResponse = {
  access: string;
  refresh: string;
  user: Record<string, unknown>;
  created: boolean;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const body = await request.json() as { code: string; state: string; redirect_uri: string };

  if (provider !== "google") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const result = await backendFetch<OAuthResponse>(
    `/api/v1/accounts/oauth/${provider}/callback/`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  const { access, refresh, user, created } = result.data;
  await setAuthCookies(access, refresh);
  return NextResponse.json({ user, created }, { status: created ? 201 : 200 });
}
