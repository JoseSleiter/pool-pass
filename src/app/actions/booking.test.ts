import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: (k: string) => (k === 'x-forwarded-for' ? '1.2.3.4' : null) })),
}));
vi.mock('@/lib/db/rate-limit', () => ({ checkRateLimit: vi.fn() }));
vi.mock('@/lib/booking/process', () => ({
  processBooking: vi.fn(async () => ({
    ok: true,
    reservation: { id: 'uuid-1', code: 'PP-AAAAA', totalUsd: 35, totalVes: 1277.5, bcvRate: 36.5 },
  })),
}));
vi.mock('@/lib/bcv', () => ({
  getBcvRate: vi.fn(async () => 36.5),
  fetchBcvRate: vi.fn(),
}));
vi.mock('@/lib/bcv-history', () => ({
  recordBcvRate: vi.fn(async () => {}),
}));

vi.mock('@/lib/db/reservations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/reservations')>()),
  sumPartySize: vi.fn(),
}));

import { submitBookingAndPay, getCurrentRate, getWeekendBookedPeople } from './booking';
import { getBcvRate } from '@/lib/bcv';
import { recordBcvRate } from '@/lib/bcv-history';
import { sumPartySize } from '@/lib/db/reservations';
import { checkRateLimit } from '@/lib/db/rate-limit';
import { processBooking } from '@/lib/booking/process';

const payload = { date: '2030-01-15', adults: 2, children: 1 };

describe('submitBookingAndPay rate limiting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks with rate_limited and never processes the booking when over the limit', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const res = await submitBookingAndPay(payload);
    expect(res).toMatchObject({ ok: false, error: 'rate_limited' });
    expect(processBooking).not.toHaveBeenCalled();
  });

  it('processes the booking normally when under the limit', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    const res = await submitBookingAndPay(payload);
    expect(res).toMatchObject({ ok: true });
    expect(processBooking).toHaveBeenCalledOnce();
  });
});

describe('BCV rate history wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getCurrentRate passes a recordHistory dep that stores the rate as source auto', async () => {
    expect(await getCurrentRate()).toBe(36.5);
    const deps = vi.mocked(getBcvRate).mock.calls[0][0];
    expect(deps.recordHistory).toBeTypeOf('function');
    await deps.recordHistory!(40.1, 1_900_000_000_000);
    expect(recordBcvRate).toHaveBeenCalledWith(40.1, 1_900_000_000_000, 'auto');
  });
});

describe('getWeekendBookedPeople', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T15:00:00Z')); // Wednesday 11:00 Caracas
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sums confirmed + checked_in people for the upcoming Saturday and Sunday', async () => {
    vi.mocked(sumPartySize).mockResolvedValue(24);
    await expect(getWeekendBookedPeople()).resolves.toBe(24);
    expect(sumPartySize).toHaveBeenCalledWith({
      dateFrom: '2026-10-10', dateTo: '2026-10-11', statuses: ['confirmed', 'checked_in'],
    });
  });

  it('returns exactly 10 (threshold is inclusive)', async () => {
    vi.mocked(sumPartySize).mockResolvedValue(10);
    await expect(getWeekendBookedPeople()).resolves.toBe(10);
  });

  it('returns null below 10 people', async () => {
    vi.mocked(sumPartySize).mockResolvedValue(9);
    await expect(getWeekendBookedPeople()).resolves.toBeNull();
  });

  it('anchors "today" to Caracas: Sunday 22:00 Caracas is still the current weekend', async () => {
    vi.setSystemTime(new Date('2026-10-12T02:00:00Z')); // Monday in UTC, Sunday in Caracas
    vi.mocked(sumPartySize).mockResolvedValue(30);
    await getWeekendBookedPeople();
    expect(sumPartySize).toHaveBeenCalledWith({
      dateFrom: '2026-10-10', dateTo: '2026-10-11', statuses: ['confirmed', 'checked_in'],
    });
  });

  it('returns null (and logs) when the database fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(sumPartySize).mockRejectedValue(new Error('db down'));
    await expect(getWeekendBookedPeople()).resolves.toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
