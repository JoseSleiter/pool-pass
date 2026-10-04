// src/lib/admin-page-params.ts
import { z } from 'zod';

/**
 * Pure helpers shared by the URL-paginated admin pages (transactions, BCV
 * rates, audit). No `server-only`, so they are unit-testable. The page sizes
 * are duplicated from `components/admin/pagination.tsx` on purpose: that module
 * is 'use client', so a server page importing a constant from it would get a
 * client reference instead of the array (a test keeps both in sync).
 */

export const ADMIN_PAGE_SIZES = [10, 25, 50] as const;
export type AdminPageSize = (typeof ADMIN_PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: AdminPageSize = 10;
export const MAX_PAGE = 10000;

/** Shape of an awaited Next.js `searchParams`. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Lenient URL parsing: anything invalid falls back to page 1 / 10 rows. */
export function parsePageParams(sp: RawSearchParams): { page: number; pageSize: AdminPageSize } {
  const rawPage = Number(firstParam(sp.page));
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= MAX_PAGE ? rawPage : 1;
  const rawSize = Number(firstParam(sp.pageSize));
  const pageSize = (ADMIN_PAGE_SIZES as readonly number[]).includes(rawSize)
    ? (rawSize as AdminPageSize)
    : DEFAULT_PAGE_SIZE;
  return { page, pageSize };
}

/** Real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDate(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** YYYY-MM-DD plus `days` (may be negative). Noon UTC avoids any DST edge. */
export function shiftIsoDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Strict validation for server-action input (no coercion: callers pass parsed numbers). */
export const pageFields = {
  page: z.number().int().min(1).max(MAX_PAGE),
  pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]),
};

export const pageQuerySchema = z.object(pageFields);
