import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

async function forward(req: NextRequest) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const headers = new Headers(req.headers);
  headers.delete("cookie");
  headers.delete("host");

  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const path = `/api/v1/media/files/${qs ? `?${qs}` : ""}`;

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  const result = await backendFetch(path, {
    method: req.method,
    accessToken: access,
    body,
    headers,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}

export async function GET(req: NextRequest) { return forward(req); }
export async function POST(req: NextRequest) { return forward(req); }
