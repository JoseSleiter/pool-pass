import { test, expect } from '@playwright/test';

test('ES | EN switch translates the landing and /reservar and persists in pp_lang', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { name: /disfruta el agua/i })).toBeVisible();

  await page.getByRole('button', { name: 'EN', exact: true }).click();

  await expect(page.getByRole('heading', { name: /enjoy the water/i })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText(/adults from/i)).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'pp_lang')?.value).toBe('en');

  // The choice survives navigation: /reservar renders in English server-side.
  await page.getByRole('link', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/reservar/);
  await expect(page.getByRole('heading', { name: /details to confirm your booking/i })).toBeVisible();

  // And back to Spanish without losing the booking state.
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await expect(page.getByRole('heading', { name: /datos para confirmar tu reserva/i })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});
