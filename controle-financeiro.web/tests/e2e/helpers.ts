import { Page } from '@playwright/test';

export const DEV_EMAIL = 'dev@controle.test';
export const DEV_PASSWORD = 'Dev@123456';

export async function login(page: Page, email = DEV_EMAIL, password = DEV_PASSWORD) {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /^entrar$/i }).click();
  // RootRoute redireciona / → /dashboard após auth state atualizar
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15_000 });
}
