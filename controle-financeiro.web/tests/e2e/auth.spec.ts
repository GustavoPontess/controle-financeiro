import { test, expect, request } from '@playwright/test';
import { login, DEV_EMAIL } from './helpers';

// Verifica se o backend está acessível antes de rodar os testes
test.beforeAll(async () => {
  const ctx = await request.newContext();
  const res = await ctx.get('http://localhost:5293/health').catch(() => null);
  if (!res || !res.ok()) {
    throw new Error('Backend não está rodando em localhost:5293. Inicie com "dotnet run" antes de rodar os testes E2E.');
  }
  await ctx.dispose();
});

test.describe('Autenticação', () => {
  test('login com credenciais válidas redireciona para Dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/(dashboard)?$/);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
  });

  test('login com senha errada exibe alerta de erro', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"]').fill(DEV_EMAIL);
    await page.locator('input[type="password"]').fill('SenhaErrada!99');
    await page.getByRole('button', { name: /^entrar$/i }).click();
    // Aceita 401 ("email ou senha inválidos") ou 429 ("muitas tentativas") — ambos são erros válidos
    await expect(page.getByText(/email ou senha inválidos|erro ao fazer login|muitas tentativas/i)).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('submit com campos vazios exibe validação inline', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: /^entrar$/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByText(/informe o e-mail|informe a senha/i).first()).toBeVisible();
  });
});
