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

  // 1. Clean up duplicate segments and map legacy paths
  normalizedPath = normalizedPath.replace(/^(\/)?api\/v1\/api\//g, "/api/v1/");
  normalizedPath = normalizedPath.replace(/^(\/)?api\/api\//g, "/api/");
  
  // Blog mapping: articles -> public/posts, categories -> public/categories
  normalizedPath = normalizedPath.replace(/\/blog\/articles\//g, "/blog/public/posts/");
  normalizedPath = normalizedPath.replace(/\/blog\/categories\//g, "/blog/public/categories/");
  normalizedPath = normalizedPath.replace(/\/blog\/tags\//g, "/blog/public/tags/");

  // 2. Auto-prepend /api/v1/ for known Django apps if missing or incomplete
  // Match patterns like /api/blog/, /blog/, /api/v1/blog/, etc.
  const appMatch = normalizedPath.match(/^\/(api\/)?(v1\/)?(accounts|blog|forum|game-logic|game-data)\//);
  
  if (appMatch) {
    const appName = appMatch[3];
    const subPath = normalizedPath.split(`/${appName}/`)[1] || "";
    normalizedPath = `/api/v1/${appName}/${subPath}`;
  }

  // 3. Ensure trailing slash before query params (Django requirement)
  const [basePath, query] = normalizedPath.split("?");
  let finalPath = basePath;
  if (!finalPath.endsWith("/") && !finalPath.split("/").pop()?.includes(".")) {
    finalPath += "/";
  }
  normalizedPath = query ? `${finalPath}?${query}` : finalPath;

  const url = `${baseUrl}${normalizedPath}`;

  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

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
