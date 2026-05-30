import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";
import { getApiBaseUrl } from "@/lib/env";

async function ensureAccess(): Promise<string | null> {
  const access = await getAccessToken();
  if (access) return access;

  const refresh = await getRefreshToken();
  if (!refresh) return null;

  const r = await backendFetch<{ access: string; refresh?: string }>(
    "/api/v1/accounts/token/refresh/",
    { method: "POST", json: { refresh } }
  );
  if (!r.ok) return null;

  await setAuthCookies(r.data.access, r.data.refresh ?? refresh);
  return r.data.access;
}

async function forward(req: NextRequest): Promise<NextResponse> {
  const access = await ensureAccess();
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const base = getApiBaseUrl().replace(/\/+$/, "");
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const target = `${base}/api/v1/media/files/${qs ? `?${qs}` : ""}`;

  const isMultipart = (req.headers.get("content-type") ?? "").includes("multipart/form-data");

  // For multipart file uploads: pass FormData directly so fetch sets the correct
  // Content-Type boundary automatically (avoids boundary mismatch when proxying).
  if (req.method === "POST" && isMultipart) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Falha ao processar o arquivo." }, { status: 400 });
    }

    const res = await fetch(target, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
      body: formData,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status });
  }

  // GET and other non-multipart requests — generic proxy via backendFetch
  const result = await backendFetch(target.replace(base, ""), {
    method: req.method,
    accessToken: access,
  });

  if (!result.ok) return NextResponse.json(result.error.data, { status: result.error.status });
  return NextResponse.json(result.data);
}

export async function GET(req: NextRequest) { return forward(req); }
export async function POST(req: NextRequest) { return forward(req); }
