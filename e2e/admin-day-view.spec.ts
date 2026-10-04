// e2e/admin-day-view.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Local admin credentials live outside the repo (never copy them in).
 * Main checkout: <repo>/supabase/…; worktree: <repo>/.worktrees/<type>/<name>/e2e → 4 levels up.
 */
function readAdminCredentials(): { email: string; password: string } | null {
  const candidates = [
    process.env.ADMIN_CREDENTIALS_FILE,
    path.resolve(__dirname, '../supabase/.local-admin-credentials.txt'),
    path.resolve(__dirname, '../../../../supabase/.local-admin-credentials.txt'),
  ].filter((p): p is string => Boolean(p));
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) return null;
  const text = fs.readFileSync(file, 'utf8');
  const email = /^email:\s*(\S+)/m.exec(text)?.[1];
  const password = /^password:\s*(.+)$/m.exec(text)?.[1]?.trim();
  return email && password ? { email, password } : null;
}

const creds = readAdminCredentials();

function caracasDate(offsetDays = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

test.describe('admin "Hoy" view', () => {
  test.skip(!creds, 'no local admin credentials file (CI)');

  test('shows the four KPI cards and moves with Ayer / Hoy', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(creds!.email);
    await page.getByLabel('Password').fill(creds!.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/admin(\?|$)/);

    const toolbar = page.getByRole('group', { name: 'Elegir día' });
    await expect(toolbar.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-current', 'date');
    for (const name of ['Ocupación', 'Check-ins', 'Ingresos', 'Cola C2P']) {
      await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
    }

    await toolbar.getByRole('button', { name: '‹ Ayer' }).click();
    await expect(page).toHaveURL(new RegExp(`date=${caracasDate(-1)}`));
    await expect(toolbar.getByRole('button', { name: 'Hoy' })).not.toHaveAttribute('aria-current', 'date');

    await toolbar.getByRole('button', { name: 'Hoy' }).click();
    await expect(page).toHaveURL(new RegExp(`date=${caracasDate(0)}`));
    await expect(toolbar.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-current', 'date');
  });
});
