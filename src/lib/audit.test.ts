import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));

vi.mock('@/lib/db/service-client', () => ({
  serviceClient: vi.fn(() => ({ from: vi.fn(() => ({ insert })) })),
}));

import { logAudit } from './audit';
import { serviceClient } from '@/lib/db/service-client';

// Silence the expected error logs; vi.clearAllMocks() resets its call history.
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
  });

  it('inserts the entry mapped to audit_log columns', async () => {
    await logAudit({ actor: 'owner@club.com', action: 'override.delete', target: '2030-01-01' });
    expect(insert).toHaveBeenCalledWith({
      actor_email: 'owner@club.com',
      action: 'override.delete',
      target: '2030-01-01',
      details: {},
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('passes details through and defaults target to null', async () => {
    await logAudit({ actor: 'owner@club.com', action: 'settings.update', details: { daily_capacity: 80 } });
    expect(insert).toHaveBeenCalledWith({
      actor_email: 'owner@club.com',
      action: 'settings.update',
      target: null,
      details: { daily_capacity: 80 },
    });
  });

  it('resolves and logs when the insert returns an error', async () => {
    insert.mockResolvedValue({ error: { message: 'permission denied' } });
    await expect(logAudit({ actor: 'a@b.c', action: 'role.upsert', target: 'x@y.z' })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it('resolves and logs when the insert rejects', async () => {
    insert.mockRejectedValue(new Error('network down'));
    await expect(logAudit({ actor: 'a@b.c', action: 'role.upsert' })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it('resolves and logs when the client cannot even be built', async () => {
    vi.mocked(serviceClient).mockImplementationOnce(() => {
      throw new Error('missing env');
    });
    await expect(logAudit({ actor: 'a@b.c', action: 'reservation.check_in', target: 'id' })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
