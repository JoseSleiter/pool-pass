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
  monthAvailability: vi.fn(),
  getSettings: vi.fn(),
  listOverrides: vi.fn(),
}));

import { submitBookingAndPay, getCurrentRate, getWeekendBookedPeople, getTodayCapacity } from './booking';
import { getBcvRate } from '@/lib/bcv';
import { recordBcvRate } from '@/lib/bcv-history';
import { sumPartySize, monthAvailability, getSettings, listOverrides } from '@/lib/db/reservations';
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

describe('getTodayCapacity', () => {
  const SETTINGS = {
    daily_capacity: 100, adult_price_usd: 15, child_price_usd: 5,
    last_bcv_rate: null, last_bcv_rate_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T15:00:00Z')); // Wednesday 11:00 Caracas
    vi.mocked(getSettings).mockResolvedValue(SETTINGS);
    vi.mocked(listOverrides).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('an untouched day has the whole default capacity free', async () => {
    vi.mocked(monthAvailability).mockResolvedValue({ '2026-10-08': 3 });
    await expect(getTodayCapacity()).resolves.toEqual({ remaining: 100, capacity: 100, dailyCapacity: 100 });
    expect(monthAvailability).toHaveBeenCalledWith('2026-10');
  });

  it('reports what bookings left against the default capacity', async () => {
    vi.mocked(monthAvailability).mockResolvedValue({ '2026-10-07': 15 });
    await expect(getTodayCapacity()).resolves.toEqual({ remaining: 15, capacity: 100, dailyCapacity: 100 });
  });

  it("uses today's override as today's capacity", async () => {
    vi.mocked(listOverrides).mockResolvedValue([
      { date: '2026-10-06', capacity: 10, reason: null },
      { date: '2026-10-07', capacity: 40, reason: 'Evento' },
    ]);
    vi.mocked(monthAvailability).mockResolvedValue({ '2026-10-07': 6 });
    await expect(getTodayCapacity()).resolves.toEqual({ remaining: 6, capacity: 40, dailyCapacity: 100 });
  });

  it('a closed day (override 0) has 0 remaining and 0 capacity', async () => {
    vi.mocked(listOverrides).mockResolvedValue([{ date: '2026-10-07', capacity: 0, reason: 'Cerrado' }]);
    vi.mocked(monthAvailability).mockResolvedValue({ '2026-10-07': 0 });
    await expect(getTodayCapacity()).resolves.toEqual({ remaining: 0, capacity: 0, dailyCapacity: 100 });
  });

  it('anchors "today" to Caracas: 22:00 on Oct 31 Caracas is still October', async () => {
    vi.setSystemTime(new Date('2026-11-01T02:00:00Z')); // Nov 1 in UTC, Oct 31 in Caracas
    vi.mocked(listOverrides).mockResolvedValue([{ date: '2026-10-31', capacity: 50, reason: null }]);
    vi.mocked(monthAvailability).mockResolvedValue({});
    await expect(getTodayCapacity()).resolves.toEqual({ remaining: 50, capacity: 50, dailyCapacity: 100 });
    expect(monthAvailability).toHaveBeenCalledWith('2026-10');
  });
});
