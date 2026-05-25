import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { getAccessToken } from "@/lib/auth-cookies";

export async function GET() {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ unread: 0 });

  const result = await backendFetch<{ unread: number }>("/api/v1/notifications/unread-count/", {
    method: "GET",
    accessToken: access,
  });

  if (!result.ok) return NextResponse.json({ unread: 0 });
  return NextResponse.json(result.data);
}
