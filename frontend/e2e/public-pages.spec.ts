import { expect, test } from "@playwright/test";

test.describe("Public pages (sem autenticação)", () => {
  test("home page carrega e exibe CTA de login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Raven/i);
    // Deve exibir link/botão de entrar ou registrar
    const loginLink = page.getByRole("link", { name: /entrar|login|play/i }).first();
    await expect(loginLink).toBeVisible({ timeout: 10_000 });
  });

  test("página de login renderiza formulário", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("textbox", { name: /e-mail/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /senha/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });

  test("página de registro renderiza formulário", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("textbox", { name: /e-mail/i })).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("fórum público é acessível sem autenticação", async ({ page }) => {
    await page.goto("/forum");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("h1, h2, [data-testid='topic'], article").first()).toBeVisible({ timeout: 15_000 });
  });

  test("blog público lista artigos", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("h1, h2, article").first()).toBeVisible({ timeout: 15_000 });
  });

  test("API health check responde 200", async ({ request }) => {
    const res = await request.get("/api/health/live/");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
  });
});
