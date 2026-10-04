import { test, expect } from '@playwright/test';

test('#como-funciona lands on the 4-step trail and every step ends up visible', async ({ page }) => {
  await page.goto('/#como-funciona');
  const trail = page.locator('#como-funciona');
  await expect(trail.getByRole('heading', { name: /así funciona tu reserva/i })).toBeVisible();
  const steps = trail.getByRole('listitem');
  await expect(steps).toHaveCount(4);
  for (let i = 0; i < 4; i++) await steps.nth(i).scrollIntoViewIfNeeded();
  // Every step that was hidden for the reveal has been shown.
  await expect(page.locator('[data-reveal="hidden"]')).toHaveCount(0);
});

test('with reduced motion nothing on the landing is ever hidden', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-reveal]')).toHaveCount(0);
});

test('amenities bento shows every tile and the opening hours', async ({ page }) => {
  await page.goto('/#amenidades');
  const section = page.locator('#amenidades');
  await expect(section.getByRole('heading', { name: /lo que encuentras en el complejo/i })).toBeVisible();
  await expect(section.locator('[data-slot="amenity-tile"]')).toHaveCount(6);
  await expect(section.getByText('Salvavidas certificados')).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Horario' })).toBeVisible();
});
