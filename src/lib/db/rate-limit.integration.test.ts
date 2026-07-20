import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

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

const KEY = 'test:rate:limit';

describe('check_rate_limit', () => {
  beforeEach(async () => {
    await supabase.from('rate_limit').delete().eq('key', KEY);
  });

  const call = (max: number, windowSeconds: number) =>
    supabase.rpc('check_rate_limit', { p_key: KEY, p_max: max, p_window_seconds: windowSeconds });

  it('allows up to max requests in the window, then blocks', async () => {
    expect((await call(3, 60)).data).toBe(true); // 1
    expect((await call(3, 60)).data).toBe(true); // 2
    expect((await call(3, 60)).data).toBe(true); // 3
    expect((await call(3, 60)).data).toBe(false); // 4 → over
    expect((await call(3, 60)).data).toBe(false); // still blocked
  });

  it('resets the counter once the window has elapsed', async () => {
    expect((await call(1, 0)).data).toBe(true); // window 0s → previous window always expired
    expect((await call(1, 0)).data).toBe(true); // resets each call → keeps allowing
  });

  it('denies execution to the anon role', async () => {
    const { error } = await supabaseAnon.rpc('check_rate_limit', {
      p_key: KEY, p_max: 1, p_window_seconds: 60,
    });
    expect(error).not.toBeNull();
  });
});
