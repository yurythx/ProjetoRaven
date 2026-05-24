import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /e-mail/i }).fill(email);
  await page.getByRole("textbox", { name: /senha/i }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/me/, { timeout: 20_000 });
}

test("anônimo é redirecionado ao tentar acessar /blog/novo", async ({ page }) => {
  await page.goto("/blog/novo");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("player é redirecionado para /blog ao tentar acessar /blog/novo", async ({ page }) => {
  await login(page, "player@raven.gg", "player123");
  await page.goto("/blog/novo");
  await expect(page).toHaveURL(/\/blog$/);
});

test("admin consegue abrir /blog/novo", async ({ page }) => {
  await login(page, "admin@raven.gg", "admin123");
  await page.goto("/blog/novo");
  await expect(page.getByRole("heading", { name: "Criar Artigo" })).toBeVisible();
});

test("endpoints de blog e forum respondem via BFF", async ({ page }) => {
  const posts = await page.request.get("/api/blog/posts/");
  expect(posts.status()).toBe(200);

  const topics = await page.request.get("/api/forum/topics/");
  expect(topics.status()).toBe(200);

  const categories = await page.request.get("/api/forum/categories/");
  expect(categories.status()).toBe(200);
});
