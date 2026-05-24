import { backendFetch } from "@/lib/backend";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await backendFetch("/api/v1/accounts/push/vapid-public-key/", { method: "GET" });
  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}
