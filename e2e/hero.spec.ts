import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);

/** Today in Caracas as YYYY-MM-DD (the app's "today"). */
function todayCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sets today's capacity override for the duration of `fn`, then restores the previous one. */
async function withTodayCapacity(capacity: number, fn: () => Promise<void>) {
  const today = todayCaracas();
  const { data: prev } = await supabase
    .from('capacity_overrides').select('date, capacity, reason').eq('date', today).maybeSingle();
  await supabase.from('capacity_overrides').upsert({ date: today, capacity });
  try {
    await fn();
  } finally {
    if (prev) await supabase.from('capacity_overrides').upsert(prev);
    else await supabase.from('capacity_overrides').delete().eq('date', today);
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('landing hero', () => {
  test('live badge: "Agotado hoy" when today is closed', async ({ page }) => {
    await withTodayCapacity(0, async () => {
      await page.goto('/');
      const badge = page.getByTestId('today-badge');
      await expect(badge).toHaveAttribute('data-state', 'soldOut');
      await expect(badge).toContainText('Agotado hoy');
    });
  });

  test('live badge: "Piscina abierta" with a pulsing dot when there is room', async ({ page }) => {
    // Far above any real occupancy, so today's bookings can't push it under 20 %.
    await withTodayCapacity(10_000, async () => {
      await page.goto('/');
      const badge = page.getByTestId('today-badge');
      await expect(badge).toHaveAttribute('data-state', 'open');
      await expect(badge).toContainText('Piscina abierta');
      await expect(badge.locator('[data-pulse]')).toBeAttached();
    });
  });

  test('wizard: "Quedan N" under each day, then the CTA carries the choice to /reservar', async ({ page }) => {
    const DAY = addDays(todayCaracas(), 30);
    await supabase.from('reservations').delete().eq('date', DAY);
    await supabase.from('capacity_overrides').upsert({ date: DAY, capacity: 7 });
    try {
      await page.goto('/');

      // Step 1: the calendar labels every available day (no hover needed on mobile).
      await page.getByTestId('hero-step-date').click();
      await expect(page.getByText('Paso 1 de 3')).toBeVisible();
      const cell = page.locator(`td[data-day="${DAY}"]:not([data-outside])`);
      for (let i = 0; i < 3 && (await cell.count()) === 0; i++) {
        await page.getByRole('button', { name: /next month|mes siguiente/i }).click();
      }
      await expect(cell).toContainText('Quedan 7');
      await cell.getByRole('button').click();

      // Step 2: one more child.
      await page.getByRole('button', { name: /^siguiente$/i }).click();
      await page.getByRole('button', { name: 'Aumentar niños' }).click();
      await expect(page.getByTestId('hero-children-count')).toHaveText('2');

      // Step 3: back to the summary, which reflects the chosen day.
      await page.getByRole('button', { name: /ver total/i }).click();
      await expect(page.getByTestId('hero-step-date')).toContainText('Quedan 7 cupos');

      await page.getByRole('link', { name: /reservar mi pase ahora/i }).click();
      await expect(page).toHaveURL(new RegExp(`/reservar\\?date=${DAY}&adults=2&children=2&pay=1`));
    } finally {
      await supabase.from('capacity_overrides').delete().eq('date', DAY);
    }
  });
});
