import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function GET() {
  const result = await backendFetch("/api/health/ready/", { method: "GET", cache: "no-store" });
  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data, { status: result.data?.status === "ok" ? 200 : 503 });
}
