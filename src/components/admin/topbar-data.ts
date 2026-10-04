// src/components/admin/topbar-data.ts
import 'server-only';
import { getSettings, searchReservations } from '@/lib/db/reservations';
import { todayCaracas } from '@/lib/dates';

export interface ShellStatus {
  /** Last cached BCV rate from settings (never fetched here); null when there is none. */
  bcv: { rate: number; at: string | null } | null;
  /** pending_payment reservations; null when the count could not be loaded. */
  pendingCount: number | null;
  /** Today in America/Caracas (YYYY-MM-DD). */
  today: string;
}

/** Topbar data for the admin shell. Each read degrades to null on its own instead of failing the page. */
export async function loadShellStatus(): Promise<ShellStatus> {
  const [settings, pending] = await Promise.allSettled([
    getSettings(),
    searchReservations({ statuses: ['pending_payment'], page: 1, pageSize: 10 }),
  ]);
  if (settings.status === 'rejected') console.error('admin shell: settings unavailable', settings.reason);
  if (pending.status === 'rejected') console.error('admin shell: pending count unavailable', pending.reason);

  const s = settings.status === 'fulfilled' ? settings.value : null;
  return {
    bcv: s && s.last_bcv_rate != null
      ? { rate: Number(s.last_bcv_rate), at: s.last_bcv_rate_at }
      : null,
    pendingCount: pending.status === 'fulfilled' ? pending.value.total : null,
    today: todayCaracas(),
  };
}
