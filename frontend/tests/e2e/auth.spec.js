import { test, expect } from '@playwright/test';

test('login and contract switch flow', async ({ page }) => {
  await page.goto('/');

  // Should redirect to login if not authenticated
  await expect(page).toHaveURL(/.*login/);

  // Fill login form (assuming standard IDs or roles)
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin');
  await page.click('button[type="submit"]');

  // Verify redirection to dashboard
  await expect(page).toHaveURL(/.*equipment/);
  
  // Verify user name in sidebar/header
  await expect(page.locator('text=admin')).toBeVisible();

  // Test contract switcher
  await page.click('#contract-switcher-btn'); // Assuming this ID exists or I'll add it
  await page.click('text=Contrato Teste'); // Assuming a contract with this name exists
  
  // Verify contract changed
  await expect(page.locator('#active-contract-id')).toContainText('TESTE');
});
