// e2e/admin-settings.spec.ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Local admin credentials are never committed. Point ADMIN_CREDENTIALS_FILE at
// the file (format "email: …" / "password: …"); without it the suite is skipped (CI).
function readCreds(): { email: string; password: string } | null {
  const file = process.env.ADMIN_CREDENTIALS_FILE
    ?? path.join(process.cwd(), 'supabase/.local-admin-credentials.txt');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const email = /^email:\s*(.+)$/m.exec(text)?.[1].trim();
  const password = /^password:\s*(.+)$/m.exec(text)?.[1].trim();
  return email && password ? { email, password } : null;
}

const creds = readCreds();

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(creds!.email);
  await page.getByLabel('Password').fill(creds!.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/admin$/);
}

test.describe('admin settings tabs', () => {
  test.skip(!creds, 'No local admin credentials file');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('the selected tab lives in ?tab= and survives a reload', async ({ page }) => {
    await page.goto('/admin/settings?tab=excepciones');
    await expect(page.getByRole('tab', { name: 'Excepciones' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'Accesos' }).click();
    await expect(page).toHaveURL(/\/admin\/settings\?tab=accesos$/);

    await page.reload();
    await expect(page.getByRole('tab', { name: 'Accesos' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Para quitar acceso, saca el email de/)).toBeVisible();
  });

  test('capacity stepper responds to the keyboard and changes can be discarded', async ({ page }) => {
    await page.goto('/admin/settings');
    const cap = page.getByRole('spinbutton', { name: 'Capacidad diaria' });
    const before = await cap.inputValue();
    await cap.focus();
    const goDown = Number(before) > 0;
    await page.keyboard.press(goDown ? 'ArrowDown' : 'ArrowUp');
    await expect(cap).toHaveValue(String(Number(before) + (goDown ? -1 : 1)));
    await expect(page.getByText('Tienes cambios sin guardar.')).toBeVisible();
    await expect(page.getByText(/Si todos son adultos/)).toBeVisible();

    await page.getByRole('button', { name: 'Descartar' }).click();
    await expect(cap).toHaveValue(before);
  });

  test('exceptions calendar shows a legend and navigates months', async ({ page }) => {
    await page.goto('/admin/settings?tab=excepciones');
    await expect(page.getByRole('list', { name: 'Leyenda' })).toContainText('Día cerrado (capacidad 0)');
    const heading = page.getByRole('heading', { level: 3 }).first();
    const current = await heading.textContent();
    await page.getByRole('button', { name: 'Mes siguiente' }).click();
    await expect(heading).not.toHaveText(current ?? '');
  });
});
