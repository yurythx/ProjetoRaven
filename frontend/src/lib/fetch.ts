async function _doFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.json !== undefined) headers.set("Content-Type", "application/json");

  const res = await fetch(path, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function jsonFetch<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const result = await _doFetch<T>(path, init);

  // On 401, attempt a silent token refresh and retry once
  if (result.status === 401 && !path.startsWith("/api/auth/")) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
    if (refreshed.ok) {
      return _doFetch<T>(path, init);
    }
  }

  return result;
}
