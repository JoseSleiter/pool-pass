import { test, expect } from '@playwright/test';

test('landing shows hero, prices and CTA navigates to /reservar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /tu día de piscina/i })).toBeVisible();
  await expect(page.locator('#precios')).toContainText(/adultos/i);
  await expect(page.locator('#precios')).toContainText('$');
  await page.getByRole('link', { name: /reservar ahora/i }).click();
  await expect(page).toHaveURL(/\/reservar$/);
  await expect(page.getByText(/paso 1 de 2/i)).toBeVisible();
});
