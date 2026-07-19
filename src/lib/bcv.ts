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
    try {
      await deps.writeCache(rate, now);
    } catch (e) {
      console.error('bcv: cache write failed (rate still served):', e);
    }
    return rate;
  } catch (e) {
    console.error('bcv: rate fetch failed:', e);
    if (cached && now - cached.fetchedAt < MAX_STALE_MS) return cached.rate;
    return null;
  }
}

// ── BCV rate sources ────────────────────────────────────────────────────────
// The official BCV rate (VES/USD) has no clean public JSON API, so we read it
// from official-rate mirrors and fall back to scraping bcv.org.ve directly.
// Sources are tried in order; the first valid, positive rate wins.

const FETCH_TIMEOUT_MS = 8000;

export function isValidRate(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export interface RateSource {
  name: string;
  fetch: () => Promise<number>;
}

/** Try each source in order; return the first valid rate. Throws if all fail. */
export async function firstSuccessfulRate(sources: RateSource[]): Promise<number> {
  const errors: string[] = [];
  for (const source of sources) {
    try {
      const rate = await source.fetch();
      if (isValidRate(rate)) return rate;
      errors.push(`${source.name}: invalid rate (${rate})`);
    } catch (e) {
      errors.push(`${source.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`all BCV sources failed — ${errors.join('; ')}`);
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Source 1: dolarapi "oficial" — the BCV rate as JSON `{ promedio }`. */
export async function fetchFromDolarApi(): Promise<number> {
  const url = process.env.BCV_RATE_URL || 'https://ve.dolarapi.com/v1/dolares/oficial';
  const body = (await getJson(url)) as { promedio?: unknown };
  const rate = Number(body.promedio);
  if (!isValidRate(rate)) throw new Error('invalid `promedio` in response');
  return rate;
}

/** Source 2: pydolarve BCV monitor — JSON `{ price }`. */
export async function fetchFromPyDolarVe(): Promise<number> {
  const url = process.env.BCV_PYDOLARVE_URL || 'https://pydolarve.org/api/v1/dollar?page=bcv&monitor=usd';
  const body = (await getJson(url)) as { price?: unknown };
  const rate = Number(body.price);
  if (!isValidRate(rate)) throw new Error('invalid `price` in response');
  return rate;
}

/** Extract the USD rate from the BCV site's `#dolar` block (VE number format). */
export function parseBcvHtml(html: string): number {
  const idx = html.search(/id=["']dolar["']/i);
  if (idx === -1) throw new Error('#dolar block not found');
  const block = html.slice(idx, idx + 800);
  for (const m of block.matchAll(/<strong>([\s\S]*?)<\/strong>/gi)) {
    const cleaned = m[1].replace(/[^\d.,]/g, '');
    if (!/\d/.test(cleaned)) continue;
    // VE format: '.' is the thousands separator, ',' the decimal separator.
    const rate = Number(cleaned.replace(/\./g, '').replace(',', '.'));
    if (isValidRate(rate)) return rate;
  }
  throw new Error('no numeric rate in #dolar block');
}

/**
 * Source 3 (last resort): scrape www.bcv.org.ve directly. Its TLS certificate
 * is frequently invalid, so we relax certificate checks for this one host via
 * an undici dispatcher (never globally).
 */
export async function fetchFromBcvSite(): Promise<number> {
  const url = process.env.BCV_SITE_URL || 'https://www.bcv.org.ve/';
  const { Agent } = await import('undici');
  const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // @ts-expect-error — `dispatcher` is an undici extension to fetch options.
    dispatcher,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseBcvHtml(await res.text());
}

export function bcvSources(): RateSource[] {
  return [
    { name: 'dolarapi', fetch: fetchFromDolarApi },
    { name: 'pydolarve', fetch: fetchFromPyDolarVe },
    { name: 'bcv.org.ve', fetch: fetchFromBcvSite },
  ];
}

/** Production fetcher: official BCV rate with multi-source fallback. */
export async function fetchBcvRate(): Promise<number> {
  return firstSuccessfulRate(bcvSources());
}
