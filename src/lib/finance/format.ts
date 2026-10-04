// src/lib/finance/format.ts

/** Placeholder for a missing value (null payment ref, rate not fixed yet…). */
export const EMPTY = '—';

/**
 * "04/10/2026 10:05" in America/Caracas. Built from formatToParts so the
 * output does not depend on the ICU punctuation of a locale.
 */
export function caracasDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Caracas',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/** Supabase may return numeric columns as strings: always go through Number(). */
export function formatUsd(n: number | string): string {
  return `$${Number(n).toFixed(2)}`;
}

export function formatBs(n: number | string | null): string {
  return n == null ? EMPTY : `Bs. ${Number(n).toFixed(2)}`;
}

/** BCV rates are stored as numeric(14,4): show all four decimals. */
export function formatRate(n: number | string | null): string {
  return n == null ? EMPTY : `Bs. ${Number(n).toFixed(4)}`;
}
