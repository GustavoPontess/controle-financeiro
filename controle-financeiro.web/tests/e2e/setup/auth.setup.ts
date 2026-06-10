import { test as setup } from '@playwright/test';
import { DEV_EMAIL, DEV_PASSWORD } from '../helpers';

const authFile = 'playwright/.auth/user.json';

setup('authenticate as dev user', async ({ page }) => {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill(DEV_EMAIL);
  await page.locator('input[type="password"]').fill(DEV_PASSWORD);
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await page.waitForURL(/\/(dashboard)?$/, { timeout: 20_000 });
  await page.context().storageState({ path: authFile });
});
