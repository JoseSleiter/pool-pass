// src/components/admin/topbar-data.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/reservations', () => ({
  getSettings: vi.fn(),
  searchReservations: vi.fn(),
}));
vi.mock('@/lib/dates', () => ({ todayCaracas: () => '2026-10-04' }));

import { loadShellStatus } from './topbar-data';
import { getSettings, searchReservations } from '@/lib/db/reservations';

const settings = (rate: number | string | null, at: string | null) => ({
  daily_capacity: 100, adult_price_usd: 7, child_price_usd: 1,
  last_bcv_rate: rate as number | null, last_bcv_rate_at: at,
});

describe('loadShellStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getSettings).mockResolvedValue(settings(36.4512, '2026-10-04T13:00:00Z'));
    vi.mocked(searchReservations).mockResolvedValue({ rows: [], total: 3 });
  });

  it('returns the cached rate, the pending count and today in Caracas', async () => {
    await expect(loadShellStatus()).resolves.toEqual({
      bcv: { rate: 36.4512, at: '2026-10-04T13:00:00Z' },
      pendingCount: 3,
      today: '2026-10-04',
    });
    expect(searchReservations).toHaveBeenCalledWith({ statuses: ['pending_payment'], page: 1, pageSize: 10 });
  });

  it('coerces a numeric string rate from PostgREST', async () => {
    vi.mocked(getSettings).mockResolvedValue(settings('36.4512', null));
    expect((await loadShellStatus()).bcv).toEqual({ rate: 36.4512, at: null });
  });

  it('reports no rate when the cache is empty', async () => {
    vi.mocked(getSettings).mockResolvedValue(settings(null, null));
    expect((await loadShellStatus()).bcv).toBeNull();
  });

  it('degrades each value independently when a read fails', async () => {
    vi.mocked(getSettings).mockRejectedValue(new Error('db down'));
    const a = await loadShellStatus();
    expect(a.bcv).toBeNull();
    expect(a.pendingCount).toBe(3);

    vi.mocked(getSettings).mockResolvedValue(settings(36, null));
    vi.mocked(searchReservations).mockRejectedValue(new Error('db down'));
    const b = await loadShellStatus();
    expect(b.bcv).toEqual({ rate: 36, at: null });
    expect(b.pendingCount).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
