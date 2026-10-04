import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import type { ReservationRow } from './reservations';

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
