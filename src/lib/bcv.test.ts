import { describe, it, expect, vi } from 'vitest';
import { getBcvRate, type RateDeps } from './bcv';

const NOW = new Date('2030-01-15T12:00:00Z').getTime();

function deps(overrides: Partial<RateDeps> = {}): RateDeps {
  return {
    fetchRate: vi.fn(async () => 36.5),
    readCache: vi.fn(async () => null),
    writeCache: vi.fn(async () => {}),
    now: () => NOW,
    ...overrides,
  };
}

describe('getBcvRate', () => {
  it('returns a fresh cached rate without fetching (< 1h old)', async () => {
    const d = deps({
      readCache: vi.fn(async () => ({ rate: 36.1, fetchedAt: NOW - 30 * 60_000 })),
    });
    expect(await getBcvRate(d)).toBe(36.1);
    expect(d.fetchRate).not.toHaveBeenCalled();
  });

  it('fetches and writes cache when cache is stale (> 1h)', async () => {
    const d = deps({
      readCache: vi.fn(async () => ({ rate: 36.1, fetchedAt: NOW - 2 * 60 * 60_000 })),
    });
    expect(await getBcvRate(d)).toBe(36.5);
    expect(d.writeCache).toHaveBeenCalledWith(36.5, NOW);
  });

  it('falls back to stale cache (< 24h) when fetch fails', async () => {
    const d = deps({
      fetchRate: vi.fn(async () => { throw new Error('down'); }),
      readCache: vi.fn(async () => ({ rate: 36.1, fetchedAt: NOW - 5 * 60 * 60_000 })),
    });
    expect(await getBcvRate(d)).toBe(36.1);
  });

  it('returns null when fetch fails and cache is older than 24h', async () => {
    const d = deps({
      fetchRate: vi.fn(async () => { throw new Error('down'); }),
      readCache: vi.fn(async () => ({ rate: 36.1, fetchedAt: NOW - 25 * 60 * 60_000 })),
    });
    expect(await getBcvRate(d)).toBeNull();
  });

  it('returns null when fetch fails and there is no cache', async () => {
    const d = deps({ fetchRate: vi.fn(async () => { throw new Error('down'); }) });
    expect(await getBcvRate(d)).toBeNull();
  });
});
