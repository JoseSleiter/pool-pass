// src/lib/db/audit-search.integration.test.ts
import { describe, it, expect } from 'vitest';
import { logAudit, listAudit } from '@/lib/audit';
import { searchAudit } from './audit-search';

// audit_log is append-only: never clean up; use a unique actor/targets and
// compare totals measured before inserting (integration files run serially).
const actor = `it-audit-search-${Date.now()}@club.com`;

describe('searchAudit', () => {
  it('filters by action, newest first, with an exact total', async () => {
    const before = (await searchAudit({ page: 1, pageSize: 1, action: 'role.upsert' })).total;
    await logAudit({ actor, action: 'role.upsert', target: `first-${actor}`, details: { role: 'operator' } });
    await logAudit({ actor, action: 'settings.update', details: { daily_capacity: 80 } });
    await logAudit({ actor, action: 'role.upsert', target: `second-${actor}`, details: { role: 'owner' } });

    const { rows, total } = await searchAudit({ page: 1, pageSize: 2, action: 'role.upsert' });
    expect(total).toBe(before + 2);
    expect(rows.map((r) => r.target)).toEqual([`second-${actor}`, `first-${actor}`]);
    expect(rows.every((r) => r.action === 'role.upsert')).toBe(true);
    expect(rows[0]).toMatchObject({ actor_email: actor, details: { role: 'owner' } });
  });

  it('without an action matches listAudit', async () => {
    const [a, b] = await Promise.all([
      searchAudit({ page: 1, pageSize: 5 }),
      listAudit({ page: 1, pageSize: 5 }),
    ]);
    expect(a.total).toBe(b.total);
    expect(a.rows.map((r) => r.id)).toEqual(b.rows.map((r) => r.id));
  });

  it('returns an empty page past the end with the real filtered total', async () => {
    const first = await searchAudit({ page: 1, pageSize: 1, action: 'role.upsert' });
    const beyond = await searchAudit({ page: 100000, pageSize: 100, action: 'role.upsert' });
    expect(beyond).toEqual({ rows: [], total: first.total });
  });
});
