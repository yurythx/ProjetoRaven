import { NextResponse } from "next/server";

const API_BASE =
  (process.env.INTERNAL_API_BASE_URL || process.env.API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/blog/rss/`, { cache: "no-store" });
    const xml = await res.text();
    return new NextResponse(xml, {
      status: res.status,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Feed unavailable", { status: 502 });
  }
}
