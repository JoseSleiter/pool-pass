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
