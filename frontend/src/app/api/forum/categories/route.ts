import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { getAccessToken } from "@/lib/auth-cookies";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const all = url.searchParams.get("all");

  // Moderators can request all (including inactive) categories
  const access = await getAccessToken();
  if (all === "1" && access) {
    const result = await backendFetch("/api/v1/forum/categories/all/", {
      method: "GET",
      accessToken: access,
      cache: "no-store",
    });
    if (result.ok) return NextResponse.json(result.data);
  }

  const page = url.searchParams.get("page") ?? "1";
  const pageSize = url.searchParams.get("page_size") ?? "200";
  const result = await backendFetch(
    `/api/v1/forum/public/categories/?page=${page}&page_size=${pageSize}`,
    { method: "GET", cache: "no-store" }
  );

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}

export async function POST(req: NextRequest) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const result = await backendFetch("/api/v1/forum/categories/", {
    method: "POST",
    accessToken: access,
    json: body,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data, { status: 201 });
}
