import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);

// A date ~3 weeks out, always in the future. Each test offsets by a few extra
// days so the three specs never collide on the same reservations row.
function targetDate(offsetDays = 21): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// The shadcn/react-day-picker calendar renders each day as
// `<td role="gridcell" data-day="YYYY-MM-DD"><button aria-label="Weekday, Month Dth, YYYY">`.
// The button's accessible name is the full spoken date (not the bare day
// number), so we target the `data-day` attribute directly instead of guessing
// a role/name query — it's an exact, locale-independent match.
async function goToDate(page: Page, date: string) {
  const cell = page.locator(`td[data-day="${date}"] button`);
  for (let i = 0; i < 6 && (await cell.count()) === 0; i++) {
    await page.getByRole('button', { name: /next month|mes siguiente/i }).click();
  }
  await expect(cell).toBeVisible();
  await cell.click();
}

async function fillBookingStep(page: Page, date: string) {
  await goToDate(page, date);
  await page.getByRole('button', { name: /aumentar adultos/i }).click(); // 2 adults
  await page.getByLabel(/^nombre$/i).fill('Ana');
  await page.getByLabel(/apellido/i).fill('Pérez');
  await page.getByLabel(/correo/i).fill('ana@example.com');
  await page.getByRole('button', { name: /continuar/i }).click();
}

async function fillPaymentStep(page: Page, otp: string) {
  await page.getByLabel(/número de documento/i).fill('12345678');
  await page.getByLabel(/teléfono/i).fill('04141234567');
  // Bank select is a @base-ui/react combobox: its trigger is a <button id="bank">
  // associated with the "Banco" <label for="bank">, so getByLabel resolves it
  // fine in a real browser (unlike the jsdom unit tests, which poke #bank
  // directly). Options render as role="option" in a portal.
  await page.getByLabel(/^banco$/i).click();
  await page.getByRole('option', { name: /banesco/i }).click();
  await page.getByLabel(/clave de pago/i).fill(otp);
  await page.getByRole('button', { name: /pagar/i }).click();
}

test.describe('booking flow', () => {
  test.beforeEach(async () => {
    for (const offset of [21, 22, 23]) {
      const date = targetDate(offset);
      await supabase.from('reservations').delete().eq('date', date);
      await supabase.from('capacity_overrides').delete().eq('date', date);
    }
  });

  test('happy path: books, pays (mock), sees confirmation with code', async ({ page }) => {
    const DATE = targetDate(21);
    await page.goto('/reservar');
    await fillBookingStep(page, DATE);
    await fillPaymentStep(page, '123456');
    await expect(page.getByText(/reserva confirmada/i)).toBeVisible({ timeout: 20_000 });
    const code = await page.getByTestId('reservation-code').textContent();
    expect(code).toMatch(/^PP-/);

    const { data } = await supabase
      .from('reservations').select('status').eq('code', code!).single();
    expect(data!.status).toBe('confirmed');
  });

  test('declined payment: shows error, reservation released', async ({ page }) => {
    const DATE = targetDate(22);
    await page.goto('/reservar');
    await fillBookingStep(page, DATE);
    await fillPaymentStep(page, '999999'); // mock decline
    await expect(page.getByText(/pago rechazado/i)).toBeVisible({ timeout: 20_000 });

    const { data } = await supabase
      .from('reservations').select('status').eq('date', DATE);
    expect(data!.every((r) => r.status === 'failed')).toBe(true);
  });

  test('sold out: capacity error reports remaining slots', async ({ page }) => {
    const DATE = targetDate(23);
    await supabase.from('capacity_overrides').insert({ date: DATE, capacity: 1 });
    await page.goto('/reservar');
    await fillBookingStep(page, DATE); // requests 2 adults > capacity 1
    await fillPaymentStep(page, '123456');
    await expect(page.getByText(/no hay cupo suficiente/i)).toBeVisible({ timeout: 20_000 });
  });
});
