// e2e/admin-reservations.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ws from 'ws';

/**
 * Local admin login, read at runtime and never committed. Point
 * ADMIN_CREDENTIALS_FILE at it when running from a worktree; without the file
 * (CI) the whole spec is skipped.
 */
function readAdminCredentials(): { email: string; password: string } | null {
  const file = process.env.ADMIN_CREDENTIALS_FILE
    ?? path.join(process.cwd(), 'supabase', '.local-admin-credentials.txt');
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const email = /^email:\s*(\S+)/m.exec(text)?.[1];
  const password = /^password:\s*(.+)$/m.exec(text)?.[1]?.trim();
  return email && password ? { email, password } : null;
}

const creds = readAdminCredentials();
test.skip(!creds, 'Local admin credentials file not found');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } },
);

const CODE = `PP-Z${Date.now().toString(36).slice(-4).toUpperCase()}`;
let seededId: string | null = null;

test.beforeAll(async () => {
  if (!creds) return;
  const d = new Date();
  d.setDate(d.getDate() + 400);
  const { data, error } = await supabase.from('reservations').insert({
    code: CODE, date: d.toISOString().slice(0, 10),
    first_name: 'Zoe', last_name: 'Pruebas', email: 'zoe.e2e@example.com',
    id_type: 'V', id_number: '99887766', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'E2E-REF-10',
  }).select('id').single();
  if (error) throw new Error(error.message);
  seededId = data.id;
});

test.afterAll(async () => {
  if (seededId) await supabase.from('reservations').delete().eq('id', seededId);
});

async function login(page: Page, next: string) {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.locator('#email').fill(creds!.email);
  await page.locator('#password').fill(creds!.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => url.pathname === next);
}

test('search, status chip, dismissible filter and detail drawer', async ({ page }) => {
  await login(page, '/admin/reservations');
  await expect(page.getByRole('heading', { level: 1, name: 'Reservas' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Buscar reservas' }).fill(CODE);
  await expect(page).toHaveURL(new RegExp(`[?&]q=${CODE}`));
  const card = page.getByTestId('res-row').filter({ hasText: CODE });
  await expect(card).toBeVisible();

  // Chip counts follow the search (status filter excluded): our one seeded row.
  await expect(page.getByRole('link', { name: 'Todas 1', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pendientes 0', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Confirmadas 1', exact: true }).click();
  await expect(page).toHaveURL(/status=confirmed/);
  const chip = page.getByRole('link', { name: 'Quitar filtro Estado: Confirmada' });
  await expect(chip).toBeVisible();
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: 'Ver detalle' }).click();
  const drawer = page.getByRole('dialog', { name: 'Detalle de la reserva' });
  await expect(drawer.getByText('E2E-REF-10')).toBeVisible();
  await drawer.getByRole('button', { name: 'Cerrar panel' }).click();
  await expect(drawer).toBeHidden();

  await chip.click();
  await expect(page).not.toHaveURL(/status=/);
});

test('Ctrl+K opens the global search from any admin page', async ({ page }) => {
  await login(page, '/admin');
  const dialog = page.getByRole('dialog', { name: 'Buscar reservas' });
  // The shortcut listener only exists once the page has hydrated: retry the key press until it lands.
  await expect(async () => {
    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  const field = dialog.getByRole('textbox', { name: 'Nombre, código o cédula' });
  await expect(field).toBeFocused();
  await field.fill(CODE);
  await field.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/admin/reservations\\?q=${CODE}$`));
  await expect(page.getByTestId('res-row').filter({ hasText: CODE })).toBeVisible();
});
