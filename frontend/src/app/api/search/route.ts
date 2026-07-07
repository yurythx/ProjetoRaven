import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

type SearchResult = {
  query: string;
  posts: unknown[];
  topics: unknown[];
};

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? request.nextUrl.searchParams.get("search") ?? "").trim();
  const rawLimit = request.nextUrl.searchParams.get("limit") ?? "10";
  const parsedLimit = Number.parseInt(rawLimit, 10);
  const limit = Number.isFinite(parsedLimit) ? String(Math.min(Math.max(parsedLimit, 1), 20)) : "10";

  if (!q) {
    return NextResponse.json({ query: "", posts: [], topics: [] });
  }

  const result = await backendFetch<SearchResult>(
    `/api/v1/search/?q=${encodeURIComponent(q)}&limit=${limit}`,
    { method: "GET", cache: "no-store" }
  );

  if (!result.ok) {
    return NextResponse.json(result.error.data, { status: result.error.status });
  }

  return NextResponse.json(result.data);
}
