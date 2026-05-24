import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/env";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const url = `${base}/api/v1/accounts/public/${encodeURIComponent(username)}/`;

  const res = await fetch(url, { next: { revalidate: 60 } });

  if (res.status === 404) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
