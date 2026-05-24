import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const result = await backendFetch("/api/v1/accounts/email/verify/resend/", {
    method: "POST",
    body,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}
