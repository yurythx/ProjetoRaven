import { NextResponse } from "next/server";

import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST(req: Request) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { client_id } = await req.json();
  if (!client_id) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const result = await backendFetch<{
    deep_link: string;
    token: string;
    expires_at: string;
  }>("/api/v1/accounts/unity-token/", {
    method: "POST",
    json: { client_id },
    accessToken,
  });

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  return NextResponse.json(result.data);
}
