import { z } from 'zod';
import type { ReservationQuery, ReservationRow } from '@/lib/db/reservations';

/**
 * Pure helpers for the admin reservation search. No `server-only` here so the
 * logic is unit-testable; the DB call lives in src/lib/db/reservations.ts.
 */

/** Generated column (lowercase, accent-free name + code + id number) terms match against. */
export const SEARCH_COLUMN = 'search_text';

const MAX_TERMS = 5;

/**
 * Splits a free-text query into safe, normalized search terms.
 * Normalization mirrors the `search_text` column: NFD, diacritics stripped,
 * lowercase. Allow-list: Unicode letters, digits, whitespace, apostrophe and
 * hyphen. Every other character (PostgREST syntax `, . ( ) : " \`, LIKE
 * wildcards `% _`, PostgREST's `*` wildcard) becomes a separator, so a term can
 * never alter the filter or widen the ilike pattern.
 */
export function searchTerms(q: string | undefined): string[] {
  if (!q) return [];
  return q
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/(\d)\.(?=\d)/g, '$1')        // 12.345.678 -> 12345678
    .replace(/(^|\s)[vepj]-(?=\d)/g, '$1') // v-12345678 -> 12345678
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t))
    .slice(0, MAX_TERMS);
}

/** ilike substring pattern for one (already sanitized) term. */
export function termPattern(term: string): string {
  return `%${term}%`;
}

type Sort = NonNullable<ReservationQuery['sort']>;

/** Whitelisted ORDER BY columns per sort key; `dir` applies to each of them. */
export const SORT_COLUMNS: Record<Sort['by'], readonly string[]> = {
  date: ['date', 'created_at'],
  code: ['code'],
  name: ['last_name', 'first_name'],
  guests: ['party_size'],
  total_usd: ['total_usd'],
  status: ['status'],
};

export const DEFAULT_SORT: Sort = { by: 'date', dir: 'desc' };

/** Inclusive row range for a 1-based page (PostgREST `.range(from, to)`). */
export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

const STATUSES = [
  'pending_payment', 'confirmed', 'failed', 'expired', 'checked_in',
] as const satisfies readonly ReservationRow['status'][];

function isRealDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate);

const reservationQuerySchema = z
  .object({
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    statuses: z
      .array(z.enum(STATUSES))
      .max(STATUSES.length)
      .optional()
      .transform((s) => (s && s.length > 0 ? [...new Set(s)] : undefined)),
    q: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((s) => (s ? s : undefined)),
    guestType: z.enum(['individual', 'family']).optional(),
    sort: z
      .object({
        by: z.enum(['date', 'code', 'name', 'guests', 'total_usd', 'status']),
        dir: z.enum(['asc', 'desc']),
      })
      .optional(),
    page: z.coerce.number().int().min(1).max(10000),
    pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50)])),
  })
  .refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, {
    message: 'dateFrom must be on or before dateTo',
    path: ['dateTo'],
  });

/** Validates untrusted input (server action args / URL params). null = invalid. */
export function parseReservationQuery(raw: unknown): ReservationQuery | null {
  const parsed = reservationQuerySchema.safeParse(raw);
  if (!parsed.success) return null;
  const { statuses, q, ...rest } = parsed.data;
  // Drop keys that normalized to undefined so callers (and toEqual) see a clean object.
  return {
    ...rest,
    ...(statuses ? { statuses } : {}),
    ...(q ? { q } : {}),
  };
}
