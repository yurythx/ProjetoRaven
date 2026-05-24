import { NextResponse } from "next/server";

import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const payload = await req.json();
  const { id } = await params;
  const result = await backendFetch(`/api/forum/replies/${encodeURIComponent(id)}/react/`, {
    method: "POST",
    json: payload,
    accessToken: access,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}

