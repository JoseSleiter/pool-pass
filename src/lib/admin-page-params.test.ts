// src/lib/admin-page-params.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

import {
  ADMIN_PAGE_SIZES, DEFAULT_PAGE_SIZE, daysBetween, firstParam, isIsoDate,
  pageQuerySchema, parsePageParams, shiftIsoDate,
} from './admin-page-params';
import { PAGE_SIZES } from '@/components/admin/pagination';

describe('ADMIN_PAGE_SIZES', () => {
  it('mirrors the shared Pagination selector', () => {
    expect([...ADMIN_PAGE_SIZES]).toEqual([...PAGE_SIZES]);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });
});

describe('firstParam', () => {
  it('takes the first value of repeated params', () => {
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam('a')).toBe('a');
    expect(firstParam(['a', 'b'])).toBe('a');
  });
});

describe('parsePageParams', () => {
  it('defaults to page 1 and 10 rows', () => {
    expect(parsePageParams({})).toEqual({ page: 1, pageSize: 10 });
  });

  it('accepts valid values', () => {
    expect(parsePageParams({ page: '3', pageSize: '25' })).toEqual({ page: 3, pageSize: 25 });
    expect(parsePageParams({ page: ['2', '9'], pageSize: '50' })).toEqual({ page: 2, pageSize: 50 });
  });

  it.each([
    ['0'], ['-1'], ['1.5'], ['abc'], [''], ['10001'],
  ])('falls back to page 1 for %j', (page) => {
    expect(parsePageParams({ page }).page).toBe(1);
  });

  it.each([['30'], ['100'], ['x'], ['']])('falls back to 10 rows for pageSize %j', (pageSize) => {
    expect(parsePageParams({ pageSize }).pageSize).toBe(10);
  });
});

describe('isIsoDate', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isIsoDate('2026-10-04')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-1-04')).toBe(false);
    expect(isIsoDate('04/10/2026')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe('shiftIsoDate / daysBetween', () => {
  it('shifts across month and year boundaries', () => {
    expect(shiftIsoDate('2026-10-04', -29)).toBe('2026-09-05');
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts whole days, negative when reversed', () => {
    expect(daysBetween('2026-09-05', '2026-10-04')).toBe(29);
    expect(daysBetween('2026-10-04', '2026-10-04')).toBe(0);
    expect(daysBetween('2026-10-04', '2026-10-03')).toBe(-1);
  });
});

describe('pageQuerySchema', () => {
  it('validates action input strictly', () => {
    expect(pageQuerySchema.safeParse({ page: 1, pageSize: 25 }).success).toBe(true);
    expect(pageQuerySchema.safeParse({ page: 0, pageSize: 25 }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ page: 1, pageSize: 30 }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ page: '1', pageSize: 10 }).success).toBe(false);
  });
});
