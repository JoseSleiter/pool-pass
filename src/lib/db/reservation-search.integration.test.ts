import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { searchReservations, type ReservationRow, type ReservationQuery } from './reservations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);

// Isolated window: nothing else in the suite books in 2031-04 / 2031-05.
const RANGE_FROM = '2031-04-01';
const RANGE_TO = '2031-05-31';
const MAIN_FROM = '2031-04-01';
const MAIN_TO = '2031-04-30';
const PAGE_DATE = '2031-05-10';

interface Seed {
  code: string; date: string; first: string; last: string; idNumber: string;
  adults: number; children: number; totalUsd: number; status: ReservationRow['status'];
}

const seedRow = (s: Seed) => ({
  code: s.code, date: s.date, first_name: s.first, last_name: s.last,
  email: 'seed@example.com', id_type: 'V', id_number: s.idNumber,
  adults: s.adults, children: s.children, total_usd: s.totalUsd, status: s.status,
  expires_at: s.status === 'pending_payment' ? '2099-01-01T00:00:00Z' : null,
  checked_in_at: s.status === 'checked_in' ? '2031-04-05T14:00:00Z' : null,
});

// Codes have 5 chars after "PP-" in production; these have 6, so they never collide.
const MAIN: Seed[] = [
  { code: 'PP-ZQ001', date: '2031-04-05', first: 'Ana', last: 'Pérez', idNumber: '11111111', adults: 1, children: 0, totalUsd: 15, status: 'confirmed' },
  { code: 'PP-ZQ002', date: '2031-04-05', first: 'Luis', last: 'Gómez', idNumber: '22222222', adults: 2, children: 1, totalUsd: 35, status: 'checked_in' },
  { code: 'PP-ZQ003', date: '2031-04-12', first: 'Maria', last: 'Garcia', idNumber: '33333333', adults: 0, children: 1, totalUsd: 5, status: 'pending_payment' },
  { code: 'PP-ZQ004', date: '2031-04-20', first: 'Pedro', last: 'Alvarez', idNumber: '44444444', adults: 3, children: 2, totalUsd: 55, status: 'failed' },
  { code: 'PP-ZQ005', date: '2031-04-20', first: 'Ana', last: 'Zamora', idNumber: '55555555', adults: 2, children: 0, totalUsd: 30, status: 'expired' },
];

// 12 rows on one date to exercise pagination; total_usd 1..12 gives a stable order.
const PAGED: Seed[] = Array.from({ length: 12 }, (_, i) => ({
  code: `PP-ZP${String(i + 1).padStart(3, '0')}`, date: PAGE_DATE, first: 'Pag', last: 'Ina',
  idNumber: String(90000000 + i), adults: 1, children: 0, totalUsd: i + 1, status: 'confirmed' as const,
}));

beforeAll(async () => {
  await supabase.from('reservations').delete().gte('date', RANGE_FROM).lte('date', RANGE_TO);
  const { error } = await supabase.from('reservations').insert([...MAIN, ...PAGED].map(seedRow));
  if (error) throw new Error(`seed failed: ${error.message}`);
});

afterAll(async () => {
  await supabase.from('reservations').delete().gte('date', RANGE_FROM).lte('date', RANGE_TO);
});

describe('party_size generated column', () => {
  it('equals adults + children for every row', async () => {
    const { data, error } = await supabase
      .from('reservations').select('code, party_size')
      .gte('date', MAIN_FROM).lte('date', MAIN_TO).order('code');
    expect(error).toBeNull();
    expect(data).toEqual([
      { code: 'PP-ZQ001', party_size: 1 },
      { code: 'PP-ZQ002', party_size: 3 },
      { code: 'PP-ZQ003', party_size: 1 },
      { code: 'PP-ZQ004', party_size: 5 },
      { code: 'PP-ZQ005', party_size: 2 },
    ]);
  });
});

describe('search_text generated column', () => {
  it('is lowercase, accent-free text of name, code and id number', async () => {
    const { data, error } = await supabase
      .from('reservations').select('search_text').eq('code', 'PP-ZQ002').single();
    expect(error).toBeNull();
    expect(data?.search_text).toBe('luis gomez pp-zq002 22222222');
  });
});

const codes = (rows: ReservationRow[]) => rows.map((r) => r.code);
const inMain = (q: Partial<ReservationQuery> = {}): ReservationQuery => ({
  dateFrom: MAIN_FROM, dateTo: MAIN_TO, page: 1, pageSize: 10, ...q,
});

describe('searchReservations', () => {
  it('returns every row in range, newest visit date first, with an exact total', async () => {
    const res = await searchReservations(inMain());
    expect(res.total).toBe(5);
    expect(res.rows.map((r) => r.date)).toEqual([
      '2031-04-20', '2031-04-20', '2031-04-12', '2031-04-05', '2031-04-05',
    ]);
  });

  it('returns rows shaped like ReservationRow (no party_size leak)', async () => {
    const { rows } = await searchReservations(inMain({ q: 'ZQ002' }));
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'adults', 'bcv_rate', 'checked_in_at', 'children', 'code', 'created_at', 'date',
      'email', 'expires_at', 'first_name', 'id', 'id_number', 'id_type', 'last_name',
      'payment_ref', 'status', 'total_usd', 'total_ves',
    ]);
  });

  it('filters by inclusive date range', async () => {
    const res = await searchReservations(inMain({
      dateFrom: '2031-04-05', dateTo: '2031-04-12', sort: { by: 'code', dir: 'asc' },
    }));
    expect(codes(res.rows)).toEqual(['PP-ZQ001', 'PP-ZQ002', 'PP-ZQ003']);
    expect(res.total).toBe(3);
  });

  it('filters by statuses', async () => {
    const res = await searchReservations(inMain({
      statuses: ['failed', 'expired'], sort: { by: 'code', dir: 'asc' },
    }));
    expect(codes(res.rows)).toEqual(['PP-ZQ004', 'PP-ZQ005']);
  });

  it('filters by guest type derived from adults + children', async () => {
    const solo = await searchReservations(inMain({ guestType: 'individual', sort: { by: 'code', dir: 'asc' } }));
    expect(codes(solo.rows)).toEqual(['PP-ZQ001', 'PP-ZQ003']);
    const family = await searchReservations(inMain({ guestType: 'family', sort: { by: 'code', dir: 'asc' } }));
    expect(codes(family.rows)).toEqual(['PP-ZQ002', 'PP-ZQ004', 'PP-ZQ005']);
  });

  it.each([
    ['first name, case-insensitive', 'ana', ['PP-ZQ001', 'PP-ZQ005']],
    ['last name with accent', 'PÉREZ', ['PP-ZQ001']],
    ['accented last name without accent', 'perez', ['PP-ZQ001']],
    ['accented last name, lowercase accent', 'pérez', ['PP-ZQ001']],
    ['accented last name, uppercase no accent', 'PEREZ', ['PP-ZQ001']],
    ['another accented name (Gómez) via gomez', 'gomez', ['PP-ZQ002']],
    ['accented query against unaccented data (Garcia)', 'García', ['PP-ZQ003']],
    ['accent-free multi-term', 'ana perez', ['PP-ZQ001']],
    ['every term must match (AND across terms)', 'ana pérez', ['PP-ZQ001']],
    ['reservation code fragment', 'zq003', ['PP-ZQ003']],
    ['id number fragment', '3333', ['PP-ZQ003']],
    ['dotted id number', '33.333.333', ['PP-ZQ003']],
    ['id number with type prefix', 'V-33333333', ['PP-ZQ003']],
  ])('q matches %s', async (_label, q, expected) => {
    const res = await searchReservations(inMain({ q, sort: { by: 'code', dir: 'asc' } }));
    expect(codes(res.rows)).toEqual(expected);
  });

  it('treats PostgREST syntax in q as plain text (no injection, no error)', async () => {
    const res = await searchReservations(inMain({ q: 'x,status.eq.failed)' }));
    expect(res).toEqual({ rows: [], total: 0 });
  });

  it('sorts by name as last_name, first_name', async () => {
    const res = await searchReservations(inMain({ sort: { by: 'name', dir: 'asc' } }));
    expect(res.rows.map((r) => r.last_name)).toEqual(['Alvarez', 'Garcia', 'Gómez', 'Pérez', 'Zamora']);
  });

  it('sorts by guests as adults + children', async () => {
    const res = await searchReservations(inMain({ sort: { by: 'guests', dir: 'desc' } }));
    expect(codes(res.rows).slice(0, 3)).toEqual(['PP-ZQ004', 'PP-ZQ002', 'PP-ZQ005']);
  });

  it('sorts by total_usd', async () => {
    const res = await searchReservations(inMain({ sort: { by: 'total_usd', dir: 'asc' } }));
    expect(codes(res.rows)).toEqual(['PP-ZQ003', 'PP-ZQ001', 'PP-ZQ005', 'PP-ZQ002', 'PP-ZQ004']);
  });

  it('paginates with an exact total', async () => {
    const q = (page: number): ReservationQuery => ({
      dateFrom: PAGE_DATE, dateTo: PAGE_DATE, sort: { by: 'total_usd', dir: 'asc' }, page, pageSize: 10,
    });
    const p1 = await searchReservations(q(1));
    expect(p1.total).toBe(12);
    expect(p1.rows).toHaveLength(10);
    expect(p1.rows[0].code).toBe('PP-ZP001');
    const p2 = await searchReservations(q(2));
    expect(codes(p2.rows)).toEqual(['PP-ZP011', 'PP-ZP012']);
    expect(p2.total).toBe(12);
  });

  it('returns no rows but the real total for a page past the end', async () => {
    const res = await searchReservations({
      dateFrom: PAGE_DATE, dateTo: PAGE_DATE, page: 3, pageSize: 10,
    });
    expect(res).toEqual({ rows: [], total: 12 });
  });
});
