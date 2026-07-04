const FRESH_MS = 60 * 60 * 1000; // serve from cache for 1h
const MAX_STALE_MS = 24 * 60 * 60 * 1000; // fallback window on fetch failure

export interface RateDeps {
  fetchRate: () => Promise<number>;
  readCache: () => Promise<{ rate: number; fetchedAt: number } | null>;
  writeCache: (rate: number, fetchedAt: number) => Promise<void>;
  now: () => number;
}

/** Returns the BCV VES/USD rate, or null if no acceptable rate is available. */
export async function getBcvRate(deps: RateDeps): Promise<number | null> {
  const cached = await deps.readCache();
  const now = deps.now();

  if (cached && now - cached.fetchedAt < FRESH_MS) return cached.rate;

  try {
    const rate = await deps.fetchRate();
    await deps.writeCache(rate, now);
    return rate;
  } catch {
    if (cached && now - cached.fetchedAt < MAX_STALE_MS) return cached.rate;
    return null;
  }
}

/** Production fetcher: dolarapi "oficial" mirror of the BCV rate. */
export async function fetchBcvRateFromMirror(): Promise<number> {
  const res = await fetch(process.env.BCV_RATE_URL!, { cache: 'no-store' });
  if (!res.ok) throw new Error(`BCV mirror HTTP ${res.status}`);
  const body = (await res.json()) as { promedio: number };
  if (typeof body.promedio !== 'number' || body.promedio <= 0) {
    throw new Error('BCV mirror returned invalid rate');
  }
  return body.promedio;
}
