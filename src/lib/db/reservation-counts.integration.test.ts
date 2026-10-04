import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { countReservationsByStatus } from './reservation-counts';
import type { ReservationRow } from './reservations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } },
);

// Isolated window: nothing else in the suite books in 2031-06.
const FROM = '2031-06-01';
const TO = '2031-06-30';

interface Seed {
  code: string; date: string; first: string; last: string; idNumber: string;
  adults: number; children: number; status: ReservationRow['status'];
}

const seedRow = (s: Seed) => ({
  code: s.code, date: s.date, first_name: s.first, last_name: s.last,
  email: 'seed@example.com', id_type: 'V', id_number: s.idNumber,
  adults: s.adults, children: s.children, total_usd: 15, status: s.status,
  expires_at: s.status === 'pending_payment' ? '2099-01-01T00:00:00Z' : null,
  checked_in_at: s.status === 'checked_in' ? '2031-06-05T14:00:00Z' : null,
});

const SEEDS: Seed[] = [
  { code: 'PP-ZC001', date: '2031-06-05', first: 'Ana', last: 'Pérez', idNumber: '71111111', adults: 1, children: 0, status: 'confirmed' },
  { code: 'PP-ZC002', date: '2031-06-05', first: 'Ana', last: 'Lopez', idNumber: '72222222', adults: 2, children: 1, status: 'confirmed' },
  { code: 'PP-ZC003', date: '2031-06-10', first: 'Luis', last: 'Gómez', idNumber: '73333333', adults: 2, children: 0, status: 'checked_in' },
  { code: 'PP-ZC004', date: '2031-06-12', first: 'Maria', last: 'Garcia', idNumber: '74444444', adults: 1, children: 0, status: 'pending_payment' },
  { code: 'PP-ZC005', date: '2031-06-20', first: 'Pedro', last: 'Alvarez', idNumber: '75555555', adults: 3, children: 0, status: 'failed' },
  { code: 'PP-ZC006', date: '2031-06-20', first: 'Ana', last: 'Zamora', idNumber: '76666666', adults: 2, children: 0, status: 'expired' },
];

const base = { page: 1, pageSize: 10 } as const;

beforeAll(async () => {
  await supabase.from('reservations').delete().gte('date', FROM).lte('date', TO);
  const { error } = await supabase.from('reservations').insert(SEEDS.map(seedRow));
  if (error) throw new Error(`seed failed: ${error.message}`);
});

afterAll(async () => {
  await supabase.from('reservations').delete().gte('date', FROM).lte('date', TO);
});

describe('countReservationsByStatus', () => {
  it('counts every chip bucket; canceled = failed + expired', async () => {
    expect(await countReservationsByStatus({ ...base, dateFrom: FROM, dateTo: TO })).toEqual({
      all: 6, confirmed: 2, checked_in: 1, pending: 1, canceled: 2,
    });
  });

  it('respects the search, date and guest-type filters', async () => {
    expect(await countReservationsByStatus({ ...base, dateFrom: FROM, dateTo: TO, q: 'ana' })).toEqual({
      all: 3, confirmed: 2, checked_in: 0, pending: 0, canceled: 1,
    });
    expect(await countReservationsByStatus({ ...base, dateFrom: '2031-06-10', dateTo: TO })).toEqual({
      all: 4, confirmed: 0, checked_in: 1, pending: 1, canceled: 2,
    });
    expect(await countReservationsByStatus({ ...base, dateFrom: FROM, dateTo: TO, guestType: 'individual' })).toEqual({
      all: 2, confirmed: 1, checked_in: 0, pending: 1, canceled: 0,
    });
  });

  it('ignores the status filter itself', async () => {
    expect(await countReservationsByStatus({ ...base, dateFrom: FROM, dateTo: TO, statuses: ['confirmed'] })).toEqual({
      all: 6, confirmed: 2, checked_in: 1, pending: 1, canceled: 2,
    });
  });

  it('is all zeros when nothing matches', async () => {
    expect(await countReservationsByStatus({ ...base, dateFrom: FROM, dateTo: TO, q: 'zzzzqq' })).toEqual({
      all: 0, confirmed: 0, checked_in: 0, pending: 0, canceled: 0,
    });
  });
});
