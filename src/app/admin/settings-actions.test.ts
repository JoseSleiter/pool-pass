import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockUser: { id: string; email?: string } | null = null;

const OWNER = 'admin@club.com';
const OPS = 'ops@club.com';
process.env.ADMIN_EMAILS = `${OWNER},${OPS}`;

vi.mock('@/lib/db/ssr-client', () => ({
  ssrClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  })),
}));
vi.mock('@/lib/db/admin-roles', () => ({ getAdminRole: vi.fn(async () => null) }));
vi.mock('@/lib/bcv', () => ({ fetchBcvRate: vi.fn() }));
vi.mock('@/lib/bcv-history', () => ({ recordBcvRate: vi.fn(async () => {}) }));
vi.mock('@/lib/db/reservations', () => ({
  writeRateCache: vi.fn(async () => {}),
  readRateCache: vi.fn(async () => ({ rate: 1, fetchedAt: 0 })),
}));
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { adminRefreshBcvRate } from './settings-actions';
import { getAdminRole } from '@/lib/db/admin-roles';
import { fetchBcvRate } from '@/lib/bcv';
import { recordBcvRate } from '@/lib/bcv-history';
import { writeRateCache, readRateCache } from '@/lib/db/reservations';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

const NOW = new Date('2030-01-15T16:00:00Z').getTime();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mockUser = { id: 'u1', email: OWNER };
  vi.mocked(getAdminRole).mockResolvedValue(null); // no row = owner
  vi.mocked(fetchBcvRate).mockResolvedValue(36.5);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('adminRefreshBcvRate', () => {
  it('rejects anonymous users before fetching anything', async () => {
    mockUser = null;
    await expect(adminRefreshBcvRate()).rejects.toThrow('Unauthorized');
    expect(fetchBcvRate).not.toHaveBeenCalled();
  });

  it('is owner-only: an operator gets Forbidden and nothing is fetched or written', async () => {
    mockUser = { id: 'u2', email: OPS };
    vi.mocked(getAdminRole).mockResolvedValue('operator');
    await expect(adminRefreshBcvRate()).rejects.toThrow('Forbidden');
    expect(fetchBcvRate).not.toHaveBeenCalled();
    expect(writeRateCache).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('bypasses the cache: always fetches and never reads the cached rate', async () => {
    await adminRefreshBcvRate();
    expect(fetchBcvRate).toHaveBeenCalledTimes(1);
    expect(readRateCache).not.toHaveBeenCalled();
  });

  it('writes the settings cache, records a manual history row and audits', async () => {
    const res = await adminRefreshBcvRate();
    expect(res).toEqual({ ok: true, rate: 36.5, at: '2030-01-15T16:00:00.000Z' });
    expect(writeRateCache).toHaveBeenCalledWith(36.5, NOW);
    expect(recordBcvRate).toHaveBeenCalledWith(36.5, NOW, 'manual');
    expect(logAudit).toHaveBeenCalledWith({ actor: OWNER, action: 'bcv.refresh', details: { rate: 36.5 } });
    expect(revalidatePath).toHaveBeenCalledWith('/admin', 'layout');
  });

  it('returns a Spanish error and writes nothing when every BCV source fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchBcvRate).mockRejectedValue(new Error('all BCV sources failed'));
    const res = await adminRefreshBcvRate();
    expect(res).toEqual({ ok: false, message: 'No se pudo obtener la tasa del BCV. Intenta de nuevo en unos minutos.' });
    expect(writeRateCache).not.toHaveBeenCalled();
    expect(recordBcvRate).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('fails without auditing when the cache cannot be written', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(writeRateCache).mockRejectedValueOnce(new Error('db down'));
    const res = await adminRefreshBcvRate();
    expect(res).toEqual({ ok: false, message: 'Se obtuvo la tasa, pero no se pudo guardar. Intenta de nuevo.' });
    expect(recordBcvRate).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('still succeeds (and audits) when only the history insert fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(recordBcvRate).mockRejectedValueOnce(new Error('history down'));
    const res = await adminRefreshBcvRate();
    expect(res.ok).toBe(true);
    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalled();
  });
});
