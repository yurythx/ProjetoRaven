import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

async function forward(req: NextRequest) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const headers = new Headers(req.headers);
  headers.delete("cookie");
  headers.delete("host");

  const body = req.method === "DELETE" ? undefined : await req.arrayBuffer();
  const result = await backendFetch("/api/v1/accounts/avatar/", {
    method: req.method,
    accessToken: access,
    body,
    headers,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  if (req.method === "DELETE") return new NextResponse(null, { status: 204 });
  return NextResponse.json(result.data);
}

export async function POST(req: NextRequest) { return forward(req); }
export async function DELETE(req: NextRequest) { return forward(req); }
