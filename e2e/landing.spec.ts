import { test, expect } from '@playwright/test';

test('landing shows hero, prices and CTA navigates to /reservar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /disfruta el agua/i })).toBeVisible();
  await expect(page.getByText(/adultos desde/i)).toBeVisible();
  await expect(page.getByText(/adultos desde/i)).toContainText('$');
  await page.getByRole('link', { name: /reservar mi pase ahora/i }).click();
  await expect(page).toHaveURL(/\/reservar/);
  // Arrives straight in the payment view of the booking card.
  await expect(page.getByRole('heading', { name: /datos para confirmar tu reserva/i })).toBeVisible();
});
