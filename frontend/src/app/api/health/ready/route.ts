import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function GET() {
  const result = await backendFetch("/api/health/ready/", { method: "GET", cache: "no-store" });
  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  const data = result.data as Record<string, unknown>;
  return NextResponse.json(data, { status: data?.status === "ok" ? 200 : 503 });
}
