import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/backend";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = url.searchParams.get("page") ?? "1";
  const pageSize = url.searchParams.get("page_size") ?? "200";

  const result = await backendFetch(`/api/forum/public/categories/?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  return NextResponse.json(result.data);
}
