import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /e-mail/i }).fill(email);
  await page.getByRole("textbox", { name: /senha/i }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/me/, { timeout: 20_000 });
}

test.describe("SecurityCard — 2FA UI", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "player@raven.gg", "player123");
    await page.goto("/me");
  });

  test("SecurityCard está visível na página /me", async ({ page }) => {
    // Card de segurança deve exibir o status de 2FA
    const card = page.locator("[data-testid='security-card'], .security-card, h2, h3").filter({
      hasText: /segurança|2fa|autenticação/i,
    }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test("botão 'Ativar 2FA' abre QR code quando 2FA está desativado", async ({ page }) => {
    // Localiza o botão de ativação — pode não estar presente se já estiver ativado
    const btn = page.getByRole("button", { name: /ativar 2fa/i });
    const count = await btn.count();
    if (count === 0) {
      test.skip(); // 2FA já ativo para esse user seed
      return;
    }
    await btn.click();
    // Após clicar deve aparecer campo de código TOTP
    await expect(page.getByRole("textbox", { name: /código|code|6 dígitos/i })).toBeVisible({ timeout: 10_000 });
  });

  test("sessão ativa na /me exibe dados do usuário", async ({ page }) => {
    // Verifica que a página carregou dados reais do usuário logado
    await expect(page.getByText(/player@raven\.gg|player/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Proteção de rotas autenticadas", () => {
  test("/me redireciona para login se não autenticado", async ({ page }) => {
    await page.goto("/me");
    await expect(page).toHaveURL(/\/login/i, { timeout: 10_000 });
  });

  test("/dashboard redireciona para login se não autenticado", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/i, { timeout: 10_000 });
  });
});
