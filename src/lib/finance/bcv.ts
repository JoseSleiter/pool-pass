// src/lib/finance/bcv.ts
import type { BcvHistoryRow } from '@/lib/bcv-history';

/** Pure helpers for the BCV rate log page (no server-only: unit-testable). */

export interface BcvRowWithVariation extends BcvHistoryRow {
  /** % change vs the chronologically previous rate; null for the oldest row of all. */
  variationPct: number | null;
}

export function variationPct(current: number, previous: number | null | undefined): number | null {
  if (previous == null || !(previous > 0)) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * `rows` are newest first (listBcvHistory order), so the previous rate of
 * rows[i] is rows[i + 1]; the last row compares with `older`, the first row
 * of the next page (null when this page holds the oldest rate).
 */
export function withVariation(rows: BcvHistoryRow[], older: BcvHistoryRow | null): BcvRowWithVariation[] {
  return rows.map((r, i) => ({
    ...r,
    variationPct: variationPct(r.rate, (rows[i + 1] ?? older)?.rate),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type VariationTrend = 'up' | 'down' | 'flat' | 'none';

export function variationTrend(pct: number | null): VariationTrend {
  if (pct == null) return 'none';
  const r = round2(pct);
  if (r === 0) return 'flat';
  return r > 0 ? 'up' : 'down';
}

/** "+1.37 %", "-8.75 %", "0.00 %", "—" (dot decimals, like the rest of the admin). */
export function formatVariation(pct: number | null): string {
  if (pct == null) return '—';
  const r = round2(pct);
  if (r === 0) return '0.00 %';
  return `${r > 0 ? '+' : '-'}${Math.abs(r).toFixed(2)} %`;
}

/** SVG coordinates for a sparkline of `values` (oldest → newest) inside width×height. */
export function sparklinePoints(
  values: number[],
  width: number,
  height: number,
  pad = 2,
): { x: number; y: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  return values.map((v, i) => ({
    x: round2(values.length === 1 ? width / 2 : pad + (i * innerW) / (values.length - 1)),
    y: round2(max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * innerH),
  }));
}

/** Text summary of the visible page; `last` is the newest rate (rows are newest first). */
export function rateSummary(rows: Pick<BcvHistoryRow, 'rate'>[]): { min: number; max: number; last: number } | null {
  if (rows.length === 0) return null;
  const rates = rows.map((r) => r.rate);
  return { min: Math.min(...rates), max: Math.max(...rates), last: rates[0] };
}

export function sourceLabel(source: string | null): string {
  if (source === 'auto') return 'Automática';
  if (source === 'manual') return 'Manual';
  return source ?? 'Sin origen';
}
