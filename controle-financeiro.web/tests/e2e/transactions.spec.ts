import { test, expect, request } from '@playwright/test';

test.beforeAll(async () => {
  const ctx = await request.newContext();
  const res = await ctx.get('http://localhost:5293/health').catch(() => null);
  if (!res || !res.ok()) {
    throw new Error('Backend não está rodando em localhost:5293. Inicie com "dotnet run" antes de rodar os testes E2E.');
  }
  await ctx.dispose();
});

test.describe('Transações', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('página de transações carrega e exibe tabela', async ({ page }) => {
    await expect(page.locator('main h1').first()).toBeVisible();
    // Tabela ou estado vazio presente
    const hasContent = await page.locator('table, [class*="empty"], [class*="vazio"]').count();
    expect(hasContent).toBeGreaterThan(0);
  });

  test('botão Nova transação abre modal com campos obrigatórios', async ({ page }) => {
    await page.locator('main').getByRole('button', { name: /nova transação/i }).click();

    // Campos obrigatórios aparecem no modal
    await expect(page.locator('input[inputmode="decimal"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /selecione a conta/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /selecione a categoria/i })).toBeVisible();

    // Cancela e verifica que os campos somem
    await page.getByRole('button', { name: /cancelar/i }).click();
    await expect(page.locator('input[inputmode="decimal"]').first()).not.toBeVisible({ timeout: 5_000 });
  });

  test('filtro por tipo Despesas filtra lista', async ({ page }) => {
    // Clica em "Despesas" no filtro
    await page.getByRole('button', { name: /^despesas$/i }).click();
    await page.waitForLoadState('networkidle');
    // Página permanece em /transactions
    await expect(page).toHaveURL(/\/transactions/);
    // Tabela ou vazio visível
    const hasContent = await page.locator('table, [class*="empty"]').count();
    expect(hasContent).toBeGreaterThan(0);
  });
});
