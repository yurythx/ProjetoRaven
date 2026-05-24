import { expect, test } from "@playwright/test";

test.describe("BFF API routes", () => {
  test("GET /api/health/live/ retorna status ok", async ({ request }) => {
    const res = await request.get("/api/health/live/");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  test("GET /api/health/ready/ retorna checks", async ({ request }) => {
    const res = await request.get("/api/health/ready/");
    expect([200, 503]).toContain(res.status());
    const data = await res.json();
    expect(data).toHaveProperty("status");
  });

  test("GET /api/blog/posts/ retorna lista paginada", async ({ request }) => {
    const res = await request.get("/api/blog/posts/");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("results");
    expect(data).toHaveProperty("count");
  });

  test("GET /api/forum/topics/ retorna lista paginada", async ({ request }) => {
    const res = await request.get("/api/forum/topics/");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("results");
    expect(data).toHaveProperty("count");
  });

  test("GET /api/forum/categories/ retorna lista de categorias", async ({ request }) => {
    const res = await request.get("/api/forum/categories/");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data) || data.hasOwnProperty("results")).toBeTruthy();
  });
});
