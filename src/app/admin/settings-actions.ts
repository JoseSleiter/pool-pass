'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { fetchBcvRate } from '@/lib/bcv';
import { recordBcvRate } from '@/lib/bcv-history';
import { writeRateCache } from '@/lib/db/reservations';
import { logAudit } from '@/lib/audit';

export type RefreshBcvResult =
  | { ok: true; rate: number; at: string }
  | { ok: false; message: string };

/**
 * Owner-only "Actualizar tasa ahora". Unlike getBcvRate (which serves the
 * settings cache for 1 h), this always hits the BCV sources via fetchBcvRate,
 * then writes the cache and appends a 'manual' bcv_rate_history row.
 * Takes no input, so there is nothing to validate with zod.
 */
export async function adminRefreshBcvRate(): Promise<RefreshBcvResult> {
  const me = await requireAdmin({ role: 'owner' });
  const now = Date.now();

  let rate: number;
  try {
    rate = await fetchBcvRate();
  } catch (e) {
    console.error('bcv refresh: fetch failed:', e);
    return { ok: false, message: 'No se pudo obtener la tasa del BCV. Intenta de nuevo en unos minutos.' };
  }

  try {
    await writeRateCache(rate, now);
  } catch (e) {
    console.error('bcv refresh: cache write failed:', e);
    return { ok: false, message: 'Se obtuvo la tasa, pero no se pudo guardar. Intenta de nuevo.' };
  }

  try {
    await recordBcvRate(rate, now, 'manual');
  } catch (e) {
    // The cache already holds the new rate; a missing history row is not worth failing over
    // (same policy as getBcvRate in src/lib/bcv.ts).
    console.error('bcv refresh: history write failed:', e);
  }

  await logAudit({ actor: me.email, action: 'bcv.refresh', details: { rate } });
  revalidatePath('/admin', 'layout'); // this page + the topbar BCV badge
  return { ok: true, rate, at: new Date(now).toISOString() };
}
