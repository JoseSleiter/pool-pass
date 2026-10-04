// src/lib/finance/transactions.test.ts
import { describe, it, expect } from 'vitest';
import {
  TRANSACTION_STATUSES, caracasDayBoundsUtc, defaultTransactionRange, parseTransactionParams,
  summarizeTransactions, transactionLinkParams, transactionQuerySchema,
} from './transactions';

const TODAY = '2026-10-04';

describe('TRANSACTION_STATUSES', () => {
  it('lists the statuses that reached payment (not expired)', () => {
    expect([...TRANSACTION_STATUSES]).toEqual(['confirmed', 'checked_in', 'pending_payment', 'failed']);
  });
});

describe('defaultTransactionRange', () => {
  it('is the last 30 days including today', () => {
    expect(defaultTransactionRange(TODAY)).toEqual({ dateFrom: '2026-09-05', dateTo: '2026-10-04' });
  });
});

describe('parseTransactionParams', () => {
  it('defaults to the last 30 days, all statuses, page 1 of 10', () => {
    expect(parseTransactionParams({}, TODAY)).toEqual({
      dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10,
    });
  });

  it('accepts a valid range, status and paging', () => {
    expect(parseTransactionParams(
      { from: '2026-09-01', to: '2026-09-30', status: 'pending_payment', page: '2', pageSize: '25' },
      TODAY,
    )).toEqual({
      dateFrom: '2026-09-01', dateTo: '2026-09-30', status: 'pending_payment', page: 2, pageSize: 25,
    });
  });

  it('keeps the default for the missing end of the range', () => {
    expect(parseTransactionParams({ from: '2026-10-01' }, TODAY)).toMatchObject({
      dateFrom: '2026-10-01', dateTo: '2026-10-04',
    });
  });

  it.each([
    ['reversed range', { from: '2026-10-04', to: '2026-10-01' }],
    ['range longer than 366 days', { from: '2025-01-01', to: '2026-10-04' }],
    ['invalid dates', { from: '2026-02-30', to: 'ayer' }],
  ])('falls back to the default range on %s', (_label, sp) => {
    expect(parseTransactionParams(sp, TODAY)).toMatchObject({ dateFrom: '2026-09-05', dateTo: '2026-10-04' });
  });

  it('ignores statuses that are not transactions', () => {
    expect(parseTransactionParams({ status: 'expired' }, TODAY)).not.toHaveProperty('status');
    expect(parseTransactionParams({ status: '' }, TODAY)).not.toHaveProperty('status');
  });
});

describe('transactionQuerySchema', () => {
  const ok = { dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10 };

  it('accepts a parsed query', () => {
    expect(transactionQuerySchema.safeParse(ok).success).toBe(true);
    expect(transactionQuerySchema.safeParse({ ...ok, status: 'failed' }).success).toBe(true);
  });

  it.each([
    ['bad status', { ...ok, status: 'expired' }],
    ['reversed range', { ...ok, dateFrom: '2026-10-05' }],
    ['too long', { ...ok, dateFrom: '2025-01-01' }],
    ['bad page size', { ...ok, pageSize: 30 }],
    ['fake date', { ...ok, dateTo: '2026-02-30' }],
  ])('rejects %s', (_label, raw) => {
    expect(transactionQuerySchema.safeParse(raw).success).toBe(false);
  });
});

describe('transactionLinkParams', () => {
  it('keeps the normalized filters for pagination links', () => {
    expect(transactionLinkParams({ dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 3, pageSize: 25 }))
      .toEqual({ from: '2026-09-05', to: '2026-10-04' });
    expect(transactionLinkParams({
      dateFrom: '2026-09-05', dateTo: '2026-10-04', status: 'confirmed', page: 1, pageSize: 10,
    })).toEqual({ from: '2026-09-05', to: '2026-10-04', status: 'confirmed' });
  });
});

describe('caracasDayBoundsUtc', () => {
  it('maps Caracas midnights (UTC-4) to a half-open UTC interval', () => {
    expect(caracasDayBoundsUtc('2026-10-01', '2026-10-04')).toEqual({
      startIso: '2026-10-01T04:00:00.000Z',
      endIso: '2026-10-05T04:00:00.000Z',
    });
  });

  it('handles a single day across a month end', () => {
    expect(caracasDayBoundsUtc('2026-10-31', '2026-10-31')).toEqual({
      startIso: '2026-10-31T04:00:00.000Z',
      endIso: '2026-11-01T04:00:00.000Z',
    });
  });
});

describe('summarizeTransactions', () => {
  it('sums collected (confirmed + checked_in) and pending, ignoring failed', () => {
    expect(summarizeTransactions([
      { status: 'confirmed', total_usd: 15, total_ves: 547.5 },
      // Supabase can return numeric columns as strings.
      { status: 'checked_in', total_usd: '35', total_ves: '1277.5' },
      { status: 'pending_payment', total_usd: 5, total_ves: null },
      { status: 'pending_payment', total_usd: 10, total_ves: null },
      { status: 'failed', total_usd: 55, total_ves: null },
    ] as unknown as Parameters<typeof summarizeTransactions>[0])).toEqual({
      collectedUsd: 50, collectedVes: 1825, collectedCount: 2, pendingUsd: 15, pendingCount: 2,
    });
  });

  it('rounds to cents (no float noise)', () => {
    expect(summarizeTransactions([
      { status: 'confirmed', total_usd: 0.1, total_ves: 0.1 },
      { status: 'confirmed', total_usd: 0.2, total_ves: 0.2 },
    ]).collectedUsd).toBe(0.3);
  });

  it('is all zeros for no rows', () => {
    expect(summarizeTransactions([])).toEqual({
      collectedUsd: 0, collectedVes: 0, collectedCount: 0, pendingUsd: 0, pendingCount: 0,
    });
  });
});
