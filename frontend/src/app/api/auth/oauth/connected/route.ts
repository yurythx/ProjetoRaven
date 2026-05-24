import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { getAccessToken } from "@/lib/auth-cookies";

type ConnectedAccount = {
  id: string;
  provider: string;
  provider_uid: string;
  created_at: string;
};

export async function GET() {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const result = await backendFetch<ConnectedAccount[]>(
    "/api/v1/accounts/oauth/connected/",
    { method: "GET", accessToken: access }
  );

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  return NextResponse.json(result.data);
}
