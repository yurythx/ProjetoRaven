import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { slug } = await params;
  const result = await backendFetch(`/api/forum/topics/${encodeURIComponent(slug)}/archive/`, {
    method: "POST",
    accessToken: access,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  revalidateTag("forum:topics");
  return NextResponse.json(result.data);
}
