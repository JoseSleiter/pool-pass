import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { recordBcvRate, listBcvHistory } from './bcv-history';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { realtime: { transport: ws as never } }
);

// bcv_rate_history is append-only. Rows are stamped slightly in the future so
// they sort before anything recorded earlier (including previous test runs).
describe('bcv rate history', () => {
  it('recorded rates come back newest first with numeric rates', async () => {
    const base = Date.now() + 60_000;
    await recordBcvRate(36.5, base, 'auto');
    await recordBcvRate(37.1234, base + 1000, 'manual');

    const { rows, total } = await listBcvHistory({ page: 1, pageSize: 2 });
    expect(total).toBeGreaterThanOrEqual(2);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rate: 37.1234, source: 'manual' });
    expect(Date.parse(rows[0].fetched_at)).toBe(base + 1000);
    expect(rows[1]).toMatchObject({ rate: 36.5, source: 'auto' });
    expect(Date.parse(rows[1].fetched_at)).toBe(base);
  });

  it('returns an empty page past the end with the real total', async () => {
    const first = await listBcvHistory({ page: 1, pageSize: 1 });
    const beyond = await listBcvHistory({ page: 100000, pageSize: 100 });
    expect(beyond.rows).toEqual([]);
    expect(beyond.total).toBe(first.total);
  });

  it('rejects a non-positive rate at the database level', async () => {
    await expect(recordBcvRate(0, Date.now(), 'auto')).rejects.toThrow();
  });

  it('is append-only even for the service role', async () => {
    const del = await supabase.from('bcv_rate_history').delete().gt('id', 0);
    expect(del.error).not.toBeNull();
  });

  it('is closed to the anon role', async () => {
    const read = await supabaseAnon.from('bcv_rate_history').select('*');
    expect(read.error).not.toBeNull();
  });
});
