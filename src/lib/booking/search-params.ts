import { todayCaracas } from '@/lib/dates';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a real calendar date (rejects e.g. 2026-13-45, 2026-02-30). */
function isRealDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Clamp an integer into [min, max]; fall back to `fallback` if not a valid integer. */
function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/**
 * Sanitize the date/adults/children query params carried from the home card.
 * Invalid or past values fall back to safe defaults (today / 2 adults / 1 child).
 * Date strings are compared lexically — YYYY-MM-DD order equals chronological order.
 */
export function parseBookingParams(sp: {
  date?: string;
  adults?: string;
  children?: string;
}): { date: string; adults: number; children: number } {
  const today = todayCaracas();
  const date =
    sp.date && DATE_RE.test(sp.date) && isRealDate(sp.date) && sp.date >= today
      ? sp.date
      : today;
  return {
    date,
    adults: clampInt(sp.adults, 2, 0, 20),
    children: clampInt(sp.children, 1, 0, 20),
  };
}
