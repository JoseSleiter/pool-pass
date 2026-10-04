import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { logAudit, listAudit } from './audit';

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

// audit_log is append-only (no delete grant), so tests never clean up: they
// use a unique actor and compare against the total measured before inserting.
const actor = `it-audit-${Date.now()}@club.com`;

describe('audit log', () => {
  it('logAudit rows come back newest first through listAudit', async () => {
    const before = (await listAudit({ page: 1, pageSize: 1 })).total;
    await logAudit({ actor, action: 'settings.update', details: { daily_capacity: 80 } });
    await logAudit({ actor, action: 'override.delete', target: '2030-03-05' });

    const { rows, total } = await listAudit({ page: 1, pageSize: 2 });
    expect(total).toBe(before + 2);
    expect(rows.map((r) => r.action)).toEqual(['override.delete', 'settings.update']);
    expect(rows[0]).toMatchObject({ actor_email: actor, target: '2030-03-05', details: {} });
    expect(rows[1]).toMatchObject({ actor_email: actor, target: null, details: { daily_capacity: 80 } });
    expect(typeof rows[0].id).toBe('number');
    expect(Number.isNaN(Date.parse(rows[0].at))).toBe(false);
  });

  it('paginates newest first and returns an empty page past the end', async () => {
    await logAudit({ actor, action: 'override.upsert', target: 'p1' });
    await logAudit({ actor, action: 'override.upsert', target: 'p2' });
    await logAudit({ actor, action: 'override.upsert', target: 'p3' });

    const page1 = await listAudit({ page: 1, pageSize: 2 });
    expect(page1.rows.map((r) => r.target)).toEqual(['p3', 'p2']);
    const page2 = await listAudit({ page: 2, pageSize: 2 });
    expect(page2.rows[0].target).toBe('p1');
    expect(page2.total).toBe(page1.total);

    const beyond = await listAudit({ page: 100000, pageSize: 100 });
    expect(beyond.rows).toEqual([]);
    expect(beyond.total).toBe(page1.total);
  });

  it('is append-only even for the service role', async () => {
    const del = await supabase.from('audit_log').delete().eq('actor_email', actor);
    expect(del.error).not.toBeNull();
    const upd = await supabase.from('audit_log').update({ action: 'x' }).eq('actor_email', actor);
    expect(upd.error).not.toBeNull();
  });

  it('is closed to the anon role', async () => {
    const read = await supabaseAnon.from('audit_log').select('*');
    expect(read.error).not.toBeNull();
    const write = await supabaseAnon.from('audit_log').insert({ actor_email: 'evil@x.com', action: 'settings.update' });
    expect(write.error).not.toBeNull();
  });
});
