import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-cookies", () => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setAuthCookies: vi.fn(),
}));

vi.mock("@/lib/backend", () => ({
  backendFetch: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getApiBaseUrl: () => "http://localhost:8000",
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("blog-admin proxy", () => {
  it("faz refresh quando access cookie está ausente", async () => {
    const authCookies = await import("@/lib/auth-cookies");
    const backend = await import("@/lib/backend");
    const route = await import("./route");

    vi.mocked(authCookies.getAccessToken).mockResolvedValue(null);
    vi.mocked(authCookies.getRefreshToken).mockResolvedValue("refresh-token");
    vi.mocked(backend.backendFetch).mockResolvedValue({ ok: true, data: { access: "new-access", refresh: "new-refresh" } });

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toBeInstanceOf(Headers);
      const authHeader = (init?.headers as Headers).get("Authorization");
      expect(authHeader).toBe("Bearer new-access");
      return jsonResponse({ ok: true }, 200);
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/blog-admin/articles?page=1", { method: "GET" });
    const res = await route.GET(req, { params: Promise.resolve({ path: ["articles"] }) });

    expect(res.status).toBe(200);
    expect(authCookies.setAuthCookies).toHaveBeenCalledWith("new-access", "new-refresh");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("faz refresh e retry quando backend retorna 401", async () => {
    const authCookies = await import("@/lib/auth-cookies");
    const backend = await import("@/lib/backend");
    const route = await import("./route");

    vi.mocked(authCookies.getAccessToken).mockResolvedValue("expired-access");
    vi.mocked(authCookies.getRefreshToken).mockResolvedValue("refresh-token");
    vi.mocked(backend.backendFetch).mockResolvedValue({ ok: true, data: { access: "new-access" } });

    let call = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      call += 1;
      if (call === 1) return jsonResponse({ detail: "Unauthorized" }, 401);
      const authHeader = (init?.headers as Headers).get("Authorization");
      expect(authHeader).toBe("Bearer new-access");
      return jsonResponse({ ok: true }, 200);
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/blog-admin/articles?page=1", { method: "GET" });
    const res = await route.GET(req, { params: Promise.resolve({ path: ["articles"] }) });

    expect(res.status).toBe(200);
    expect(authCookies.setAuthCookies).toHaveBeenCalledWith("new-access", "refresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

