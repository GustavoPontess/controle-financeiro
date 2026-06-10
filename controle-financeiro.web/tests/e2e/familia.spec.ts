import { test, expect, request } from '@playwright/test';

test.beforeAll(async () => {
  const ctx = await request.newContext();
  const res = await ctx.get('http://localhost:5293/health').catch(() => null);
  if (!res || !res.ok()) {
    throw new Error('Backend não está rodando em localhost:5293. Inicie com "dotnet run" antes de rodar os testes E2E.');
  }
  await ctx.dispose();
});

test.describe('Família', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/familias');
    await page.waitForLoadState('networkidle');
  });

  test('página de família carrega sem erro', async ({ page }) => {
    await expect(page.locator('main h1').first()).toBeVisible();
    // Tem família ou exibe botão pra criar/convidar
    const hasFamilia = await page.locator('text=/família|membro|convidar/i').count();
    expect(hasFamilia).toBeGreaterThan(0);
  });

  test('convidar membro abre modal com campo de e-mail', async ({ page }) => {
    const convidarBtn = page.getByRole('button', { name: /convidar/i }).first();
    if (await convidarBtn.isVisible()) {
      await convidarBtn.click();
      await expect(page.locator('input[type="email"], input[placeholder*="email"]').first()).toBeVisible({ timeout: 5_000 });
    } else {
      // Sem família — botão criar família deve estar visível
      await expect(page.getByRole('button', { name: /criar|nova família/i }).first()).toBeVisible();
    }
  });

  test('despesas compartilhadas: seção visível ou skip sem família', async ({ page }) => {
    const famCard = page.locator('[class*="card"], [class*="familia"], [class*="group"]').first();
    if (!(await famCard.isVisible({ timeout: 2_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await famCard.click();
    await page.waitForLoadState('networkidle');
    // Qualquer conteúdo da página de detalhe carregou
    await expect(page.locator('main').first()).toBeVisible({ timeout: 5_000 });
  });
});
