import { getApiBaseUrl } from "@/lib/env";

export type BackendError = {
  status: number;
  data: unknown;
};

export async function backendFetch<T>(
  path: string,
  init?: RequestInit & {
    json?: unknown;
    accessToken?: string | null;
    next?: { revalidate?: number; tags?: string[] };
  }
): Promise<{ ok: true; data: T } | { ok: false; error: BackendError }> {
  const baseUrl = getApiBaseUrl();
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Ensure trailing slash before query params (Django requirement)
  const [basePath, query] = normalizedPath.split("?");
  let finalPath = basePath;
  if (!finalPath.endsWith("/") && !finalPath.split("/").pop()?.includes(".")) {
    finalPath += "/";
  }
  normalizedPath = query ? `${finalPath}?${query}` : finalPath;

  const url = `${baseUrl}${normalizedPath}`;

  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("x-request-id")) {
    let rid = "";
    try {
      const mod = await import("next/headers");
      const hdrs = await mod.headers();
      rid = (hdrs.get("x-request-id") || "").trim();
    } catch {}
    headers.set("x-request-id", rid || crypto.randomUUID());
  }

  if (init?.accessToken) {
    headers.set("Authorization", `Bearer ${init.accessToken}`);
  }

  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  let res: Response;
  try {
    const fetchInit: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
      ...init,
      headers,
      body,
    };

    if (init?.cache) {
      fetchInit.cache = init.cache;
    } else if (init?.next?.revalidate === undefined) {
      fetchInit.cache = "no-store";
    }

    res = await fetch(url, fetchInit);
  } catch (err) {
    return { ok: false, error: { status: 500, data: err instanceof Error ? err.message : String(err) } };
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    return { ok: false, error: { status: res.status, data } };
  }

  return { ok: true, data: data as T };
}
