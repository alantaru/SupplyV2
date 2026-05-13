import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Refinery & CSV Upload Flow', () => {
  test('should upload a CSV and show suggested mapping', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*equipment/);
    
    // Navigate to Upload/Refinery section
    // Assuming there's a link or button for "Upload de Bases"
    await page.click('text=Upload de Bases');
    
    // 1. Create a dummy CSV file for testing
    const testCsvPath = path.resolve(__dirname, 'test_mapa.csv');
    fs.writeFileSync(testCsvPath, 'SERIE;FILA;MODELO;STATUS\nABC123;F001;C405;ATIVO\n');

    // 2. Upload the file
    // Assuming an input type="file" is present
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Selecionar Arquivo'); // Trigger the file chooser
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testCsvPath);

    // 3. Verify Refinery Mapping UI appears
    await expect(page.locator('text=Mapeamento de Colunas')).toBeVisible();
    
    // 4. Verify suggestions
    await expect(page.locator('text=Detectado: SERIE')).toBeVisible();
    
    // Cleanup
    fs.unlinkSync(testCsvPath);
  });
});
