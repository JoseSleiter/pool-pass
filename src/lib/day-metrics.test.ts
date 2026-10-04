import { describe, it, expect } from 'vitest';
import {
  computeDayMetrics, hourLabel, hourlySeries, isIsoDate, occupancyLevel, occupancyPercent,
  parseDayParam, shiftIsoDate,
} from './day-metrics';
import type { ReservationRow } from '@/lib/db/reservations';

describe('occupancyPercent', () => {
  it('is the rounded whole percent of capacity in use', () => {
    expect(occupancyPercent(0, 100)).toBe(0);
    expect(occupancyPercent(45, 100)).toBe(45);
    expect(occupancyPercent(1, 3)).toBe(33);
    expect(occupancyPercent(141, 200)).toBe(71); // 70.5 rounds up
  });

  it('can exceed 100 when the day is overbooked', () => {
    expect(occupancyPercent(120, 100)).toBe(120);
  });

  it('is null for a closed day (capacity 0 or less)', () => {
    expect(occupancyPercent(0, 0)).toBeNull();
    expect(occupancyPercent(3, 0)).toBeNull();
  });
});

describe('occupancyLevel (roadmap §2 bands)', () => {
  it.each<[number, string]>([
    [0, 'normal'],
    [70, 'normal'],
    [71, 'high'],
    [90, 'high'],
    [91, 'peak'],
    [100, 'peak'],
    [130, 'peak'],
  ])('%i %% → %s', (pct, level) => {
    expect(occupancyLevel(pct)).toBe(level);
  });
});

describe('isIsoDate', () => {
  it('accepts real calendar dates in YYYY-MM-DD', () => {
    expect(isIsoDate('2030-01-15')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true); // leap year
  });

  it('rejects malformed or impossible dates', () => {
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate('hoy')).toBe(false);
    expect(isIsoDate('2030-1-15')).toBe(false);
    expect(isIsoDate('2030-02-31')).toBe(false);
    expect(isIsoDate('2029-02-29')).toBe(false);
    expect(isIsoDate('2030-01-15T00:00:00Z')).toBe(false);
  });
});

describe('shiftIsoDate', () => {
  it('moves by whole days across month and year boundaries', () => {
    expect(shiftIsoDate('2030-01-15', -1)).toBe('2030-01-14');
    expect(shiftIsoDate('2030-01-15', 1)).toBe('2030-01-16');
    expect(shiftIsoDate('2030-03-01', -1)).toBe('2030-02-28');
    expect(shiftIsoDate('2030-12-31', 1)).toBe('2031-01-01');
  });
});

describe('parseDayParam', () => {
  it('keeps a valid ?date= value', () => {
    expect(parseDayParam('2030-01-15', '2030-06-01')).toBe('2030-01-15');
  });

  it('falls back to today for missing, invalid or repeated params', () => {
    expect(parseDayParam(undefined, '2030-06-01')).toBe('2030-06-01');
    expect(parseDayParam('2030-02-31', '2030-06-01')).toBe('2030-06-01');
    expect(parseDayParam(['2030-01-15', '2030-01-16'], '2030-06-01')).toBe('2030-06-01');
  });
});

describe('hourlySeries', () => {
  it('is empty when nobody checked in', () => {
    expect(hourlySeries([])).toEqual([]);
  });

  it('spans first to last check-in hour, filling gaps with zero', () => {
    expect(hourlySeries([
      { hour: 9, people: 3 },
      { hour: 12, people: 5 },
    ])).toEqual([
      { hour: 9, people: 3 },
      { hour: 10, people: 0 },
      { hour: 11, people: 0 },
      { hour: 12, people: 5 },
    ]);
  });

  it('keeps a single hour as a single bucket and does not depend on input order', () => {
    expect(hourlySeries([{ hour: 14, people: 1 }])).toEqual([{ hour: 14, people: 1 }]);
    expect(hourlySeries([{ hour: 11, people: 2 }, { hour: 10, people: 1 }])).toEqual([
      { hour: 10, people: 1 },
      { hour: 11, people: 2 },
    ]);
  });
});

describe('hourLabel', () => {
  it('formats a Caracas hour as HH:00 (24h)', () => {
    expect(hourLabel(0)).toBe('00:00');
    expect(hourLabel(9)).toBe('09:00');
    expect(hourLabel(17)).toBe('17:00');
  });
});

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: 'r1', code: 'PP-0001', date: '2030-01-15',
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 0,
    total_usd: 20, bcv_rate: 36.5, total_ves: 730,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T12:00:00Z',
    ...over,
  };
}

describe('computeDayMetrics', () => {
  const rows: ReservationRow[] = [
    row({ adults: 2, children: 1, total_usd: 30, total_ves: 1095 }),                       // confirmed
    row({ status: 'checked_in', adults: 1, children: 0, total_usd: 10, total_ves: 365,
      checked_in_at: '2030-01-15T13:05:00Z' }),                                              // 09:05 Caracas
    row({ status: 'checked_in', adults: 2, children: 2, total_usd: 25.5, total_ves: 930.75,
      checked_in_at: '2030-01-15T15:40:00Z' }),                                              // 11:40 Caracas
    row({ status: 'pending_payment', adults: 3, children: 0, total_usd: 30, total_ves: null }),
    row({ status: 'pending_payment', adults: 1, children: 0, total_usd: 10.1, total_ves: null }),
    row({ status: 'failed', adults: 9, children: 9, total_usd: 999, total_ves: 1 }),       // ignored
  ];

  it('uses settings.daily_capacity when the day has no override', () => {
    const m = computeDayMetrics({
      date: '2030-01-15', rows, dailyCapacity: 100,
      overrides: [{ date: '2030-01-16', capacity: 0, reason: 'Otro día' }],
    });
    expect(m.capacity).toBe(100);
    expect(m.defaultCapacity).toBe(100);
    expect(m.override).toBeNull();
  });

  it('uses the day override (closed day = capacity 0) and keeps its reason', () => {
    const m = computeDayMetrics({
      date: '2030-01-15', rows, dailyCapacity: 100,
      overrides: [{ date: '2030-01-15', capacity: 0, reason: 'Mantenimiento' }],
    });
    expect(m.capacity).toBe(0);
    expect(m.defaultCapacity).toBe(100);
    expect(m.override).toEqual({ capacity: 0, reason: 'Mantenimiento' });
  });

  it('sums people, check-ins, collected and pending money by status', () => {
    const m = computeDayMetrics({ date: '2030-01-15', rows, dailyCapacity: 100, overrides: [] });
    expect(m.confirmedPeople).toBe(8);      // 3 + 1 + 4 (confirmed + checked_in)
    expect(m.checkedInPeople).toBe(5);
    expect(m.checkedInParties).toBe(2);
    expect(m.checkinsByHour).toEqual([{ hour: 9, people: 1 }, { hour: 11, people: 4 }]);
    expect(m.collected).toEqual({ usd: 65.5, ves: 2390.75, count: 3 });
    expect(m.pending).toEqual({ usd: 40.1, count: 2 });
  });

  it('returns zeros for an empty day', () => {
    const m = computeDayMetrics({ date: '2030-01-15', rows: [], dailyCapacity: 80, overrides: [] });
    expect(m).toEqual({
      capacity: 80, defaultCapacity: 80, override: null,
      confirmedPeople: 0, checkedInPeople: 0, checkedInParties: 0, checkinsByHour: [],
      collected: { usd: 0, ves: 0, count: 0 },
      pending: { usd: 0, count: 0 },
    });
  });
});
