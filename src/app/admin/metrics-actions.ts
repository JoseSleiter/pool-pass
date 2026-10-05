'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getSettings, listOverrides, listReservationsByDate } from '@/lib/db/reservations';
import { computeDayMetrics, isIsoDate, type DayMetrics } from '@/lib/day-metrics';

const dateSchema = z.string().refine(isIsoDate);

/**
 * KPIs for the admin "Hoy" view. Read-only (no audit entry). Capacity is the
 * day's effective capacity (capacity_overrides first), so closed and special
 * days are right.
 */
export async function adminGetDayMetrics(date: string): Promise<DayMetrics> {
  await requireAdmin();
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) throw new Error('Invalid date');
  const day = parsed.data;
  const [rows, settings, overrides] = await Promise.all([
    listReservationsByDate(day),
    getSettings(),
    listOverrides(),
  ]);
  return computeDayMetrics({ date: day, rows, dailyCapacity: settings.daily_capacity, overrides });
}
