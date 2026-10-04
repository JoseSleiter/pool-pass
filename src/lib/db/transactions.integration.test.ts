// src/lib/db/transactions.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { searchTransactions, transactionTotals } from './transactions';
import type { TransactionQuery } from '@/lib/finance/transactions';
import type { ReservationRow } from './reservations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } },
);

// Isolated: codes PP-ZT### (6 chars after "PP-", never produced by reserve_slots),
// created_at in March 2032 and a visit date nobody else books.
const CODE_LIKE = 'PP-ZT%';
const VISIT = '2032-03-20';

interface Seed {
  code: string; createdAt: string; status: ReservationRow['status'];
  usd: number; ves: number | null; rate: number | null; ref: string | null;
}

const SEEDS: Seed[] = [
  // 2032-03-02 00:00 Caracas — first instant of the range: included.
  { code: 'PP-ZT001', createdAt: '2032-03-02T04:00:00Z', status: 'confirmed', usd: 15, ves: 547.5, rate: 36.5, ref: 'REF001' },
  { code: 'PP-ZT002', createdAt: '2032-03-05T15:00:00Z', status: 'checked_in', usd: 35, ves: 1277.5, rate: 36.5, ref: 'REF002' },
  { code: 'PP-ZT003', createdAt: '2032-03-06T15:00:00Z', status: 'pending_payment', usd: 5, ves: null, rate: null, ref: null },
  { code: 'PP-ZT004', createdAt: '2032-03-07T15:00:00Z', status: 'failed', usd: 55, ves: null, rate: null, ref: null },
  // expired never reached payment: never listed.
  { code: 'PP-ZT005', createdAt: '2032-03-08T15:00:00Z', status: 'expired', usd: 99, ves: null, rate: null, ref: null },
  // 2032-03-01 23:59:59 Caracas — the day before the range: excluded.
  { code: 'PP-ZT006', createdAt: '2032-03-02T03:59:59Z', status: 'confirmed', usd: 20, ves: 730, rate: 36.5, ref: 'REF006' },
  { code: 'PP-ZT007', createdAt: '2032-03-31T16:00:00Z', status: 'pending_payment', usd: 10, ves: null, rate: null, ref: null },
  // 2032-04-01 00:00 Caracas — the day after the range: excluded.
  { code: 'PP-ZT008', createdAt: '2032-04-01T04:00:00Z', status: 'confirmed', usd: 30, ves: 1095, rate: 36.5, ref: 'REF008' },
];

const seedRow = (s: Seed) => ({
  code: s.code, date: VISIT, first_name: 'Tx', last_name: s.code.slice(-3),
  email: 'seed@example.com', id_type: 'V', id_number: `7700${s.code.slice(-3)}`,
  adults: 1, children: 0, total_usd: s.usd, total_ves: s.ves, bcv_rate: s.rate,
  status: s.status, payment_ref: s.ref, created_at: s.createdAt,
  expires_at: s.status === 'pending_payment' ? '2099-01-01T00:00:00Z' : null,
  checked_in_at: s.status === 'checked_in' ? '2032-03-20T14:00:00Z' : null,
});

const MARCH: TransactionQuery = { dateFrom: '2032-03-02', dateTo: '2032-03-31', page: 1, pageSize: 10 };

beforeAll(async () => {
  await supabase.from('reservations').delete().like('code', CODE_LIKE);
  const { error } = await supabase.from('reservations').insert(SEEDS.map(seedRow));
  if (error) throw new Error(`seed failed: ${error.message}`);
});

afterAll(async () => {
  await supabase.from('reservations').delete().like('code', CODE_LIKE);
});

describe('searchTransactions', () => {
  it('lists payment-stage reservations created in the Caracas range, newest first', async () => {
    const res = await searchTransactions(MARCH);
    expect(res.total).toBe(5);
    expect(res.rows.map((r) => r.code)).toEqual(['PP-ZT007', 'PP-ZT004', 'PP-ZT003', 'PP-ZT002', 'PP-ZT001']);
  });

  it('returns exactly the transaction columns', async () => {
    const { rows } = await searchTransactions(MARCH);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'bcv_rate', 'checked_in_at', 'code', 'created_at', 'first_name', 'id', 'last_name',
      'payment_ref', 'status', 'total_usd', 'total_ves',
    ]);
  });

  it('filters by a single status', async () => {
    const res = await searchTransactions({ ...MARCH, status: 'confirmed' });
    expect(res.rows.map((r) => r.code)).toEqual(['PP-ZT001']);
    expect(res.total).toBe(1);
  });

  it('respects the Caracas day boundary on both ends', async () => {
    const before = await searchTransactions({ ...MARCH, dateFrom: '2032-03-01', dateTo: '2032-03-01' });
    expect(before.rows.map((r) => r.code)).toEqual(['PP-ZT006']);
    const after = await searchTransactions({ ...MARCH, dateFrom: '2032-04-01', dateTo: '2032-04-01' });
    expect(after.rows.map((r) => r.code)).toEqual(['PP-ZT008']);
  });

  it('returns no rows but the real total for a page past the end', async () => {
    await expect(searchTransactions({ ...MARCH, page: 2 })).resolves.toEqual({ rows: [], total: 5 });
  });
});

describe('transactionTotals', () => {
  const expected = { collectedUsd: 50, collectedVes: 1825, collectedCount: 2, pendingUsd: 15, pendingCount: 2 };

  it('sums collected and pending for the range (failed/expired ignored)', async () => {
    await expect(transactionTotals(MARCH)).resolves.toEqual(expected);
  });

  it('reads in chunks and still sums every row', async () => {
    // 4 qualifying rows with chunks of 2: two full chunks, then an empty one.
    await expect(transactionTotals(MARCH, 2)).resolves.toEqual(expected);
    await expect(transactionTotals(MARCH, 3)).resolves.toEqual(expected);
  });

  it('is all zeros for an empty range', async () => {
    await expect(transactionTotals({ dateFrom: '2032-03-10', dateTo: '2032-03-11' })).resolves.toEqual({
      collectedUsd: 0, collectedVes: 0, collectedCount: 0, pendingUsd: 0, pendingCount: 0,
    });
  });
});
