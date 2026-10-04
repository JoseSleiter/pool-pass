import { caracasTime, shortDateEs } from '@/lib/dates';

// Mirrors FRESH_MS / MAX_STALE_MS in src/lib/bcv.ts. Not imported from there on
// purpose: that module lazy-imports 'undici' and must stay out of client bundles.
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "hace 25 minutos" — age of the cached rate. */
export function rateAgeLabel(atIso: string, now: number): string {
  const ms = Math.max(0, now - Date.parse(atIso));
  if (ms < MIN) return 'hace menos de 1 minuto';
  if (ms < HOUR) return `hace ${plural(Math.floor(ms / MIN), 'minuto', 'minutos')}`;
  if (ms < DAY) return `hace ${plural(Math.floor(ms / HOUR), 'hora', 'horas')}`;
  return `hace ${plural(Math.floor(ms / DAY), 'día', 'días')}`;
}

/** "dom, 4 oct. · 13:05" — when the rate was fetched, in Caracas time. */
export function rateStampEs(atIso: string): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date(atIso));
  return `${shortDateEs(day)} · ${caracasTime(atIso)}`;
}

export type RateFreshness = 'fresh' | 'stale' | 'expired';

/** fresh: served from cache; stale: next use refetches; expired: no fallback if BCV is down. */
export function rateFreshness(atIso: string, now: number): RateFreshness {
  const ms = now - Date.parse(atIso);
  if (ms < HOUR) return 'fresh';
  if (ms < DAY) return 'stale';
  return 'expired';
}
