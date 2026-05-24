import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/backend";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  const result = await backendFetch(`/api/blog/public/posts/${encodeURIComponent(slug)}/${qs ? `?${qs}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}

