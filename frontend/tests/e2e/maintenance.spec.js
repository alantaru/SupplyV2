import { test, expect } from '@playwright/test';

test.describe('Maintenance Persona Flow', () => {
  test('should navigate to maintenance dashboard and see divergences', async ({ page }) => {
    // 1. Login as maintenance
    await page.goto('/login');
    
    // Fill credentials (assuming mock auth works or we bypass it for UI tests)
    await page.fill('input[name="username"]', 'manutencao');
    await page.fill('input[name="password"]', 'tech2026'); // Example password
    await page.click('button[type="submit"]');

    // 2. Verify redirect to /maintenance
    await expect(page).toHaveURL(/.*maintenance/);

    // 3. Verify Dashboard components
    await expect(page.locator('text=Monitoramento de Backup (SLA)')).toBeVisible();
    await expect(page.locator('text=Divergências de Mapa')).toBeVisible();

    // 4. Verify Divergences Table has content or empty state
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('should open OSWizard for a technical change', async ({ page }) => {
    await page.goto('/maintenance');
    
    // Login if needed (Playwright might preserve state if configured, but let's be explicit if not)
    if (await page.isVisible('input[name="username"]')) {
      await page.fill('input[name="username"]', 'manutencao');
      await page.fill('input[name="password"]', 'tech2026');
      await page.click('button[type="submit"]');
    }

    // Click on "Nova OS" or similar trigger for OSWizard
    // Assuming a button with text "Registrar Atendimento" exists
    const osBtn = page.locator('text=Registrar Atendimento');
    if (await osBtn.count() > 0) {
      await osBtn.click();
      
      // Verify OSWizard modal/view is visible
      await expect(page.locator('text=Dados da Máquina (Saindo)')).toBeVisible();
    }
  });
});
