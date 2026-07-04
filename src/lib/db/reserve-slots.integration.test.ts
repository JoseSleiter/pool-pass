import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Node 20 has no global WebSocket, which @supabase/realtime-js requires even
// though this test never opens a realtime channel. Supplying the `ws`
// transport lets the client construct without needing Node 22+.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);

const DATE = '2030-01-15';

function reserve(adults: number, children = 0) {
  return supabase.rpc('reserve_slots', {
    p_date: DATE,
    p_first_name: 'Ana',
    p_last_name: 'Pérez',
    p_email: 'ana@example.com',
    p_id_type: 'V',
    p_id_number: '12345678',
    p_adults: adults,
    p_children: children,
    p_total_usd: adults * 15 + children * 5,
  });
}

describe('reserve_slots', () => {
  beforeEach(async () => {
    await supabase.from('reservations').delete().eq('date', DATE);
    await supabase.from('capacity_overrides').delete().eq('date', DATE);
    await supabase.from('capacity_overrides').insert({ date: DATE, capacity: 10 });
  });

  it('accepts a booking within capacity and returns a code', async () => {
    const { data, error } = await reserve(2, 1);
    expect(error).toBeNull();
    const row = data![0];
    expect(row.ok).toBe(true);
    expect(row.code).toMatch(/^PP-[A-Z0-9]{5}$/);
  });

  it('rejects when the request exceeds remaining capacity, reporting remaining', async () => {
    await reserve(8); // 8 of 10 taken
    const { data } = await reserve(3);
    const row = data![0];
    expect(row.ok).toBe(false);
    expect(row.remaining).toBe(2);
  });

  it('treats capacity 0 override as closed', async () => {
    await supabase.from('capacity_overrides').update({ capacity: 0 }).eq('date', DATE);
    const { data } = await reserve(1);
    expect(data![0].ok).toBe(false);
    expect(data![0].remaining).toBe(0);
  });

  it('never oversells under concurrent requests', async () => {
    // 6 concurrent requests of 3 people each against capacity 10 → at most 3 can win
    const results = await Promise.all(Array.from({ length: 6 }, () => reserve(3)));
    const accepted = results.filter((r) => r.data![0].ok).length;
    expect(accepted).toBe(3);
    const { data: rows } = await supabase
      .from('reservations')
      .select('adults, children')
      .eq('date', DATE);
    const total = rows!.reduce((s, r) => s + r.adults + r.children, 0);
    expect(total).toBeLessThanOrEqual(10);
  });
});
