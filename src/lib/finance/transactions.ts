// src/lib/finance/transactions.ts
import { z } from 'zod';
import { roundMoney } from '@/lib/money';
import type { ReservationRow } from '@/lib/db/reservations';
import {
  daysBetween, firstParam, isIsoDate, pageFields, parsePageParams, shiftIsoDate,
  type AdminPageSize, type RawSearchParams,
} from '@/lib/admin-page-params';

/**
 * C2P transactions = reservations that reached the payment step. `expired`
 * never attempted a charge, so it is not a transaction. Pure module (no
 * server-only): the DB query lives in src/lib/db/transactions.ts.
 */
export const TRANSACTION_STATUSES = [
  'confirmed', 'checked_in', 'pending_payment', 'failed',
] as const satisfies readonly ReservationRow['status'][];

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const DEFAULT_RANGE_DAYS = 30;
/** Longest accepted range, inclusive (keeps the totals scan bounded). */
export const MAX_RANGE_DAYS = 366;

export type TransactionRow = Pick<
  ReservationRow,
  'id' | 'code' | 'first_name' | 'last_name' | 'total_usd' | 'bcv_rate' | 'total_ves'
  | 'status' | 'payment_ref' | 'checked_in_at' | 'created_at'
>;

export interface TransactionQuery {
  /** YYYY-MM-DD, Caracas calendar day of `created_at`, inclusive. */
  dateFrom: string;
  dateTo: string;
  status?: TransactionStatus;
  page: number;
  pageSize: AdminPageSize;
}

export interface TransactionTotals {
  /** confirmed + checked_in */
  collectedUsd: number;
  collectedVes: number;
  collectedCount: number;
  /** pending_payment: the Bs. amount is only fixed on confirmation, so USD only. */
  pendingUsd: number;
  pendingCount: number;
}

export function defaultTransactionRange(today: string): { dateFrom: string; dateTo: string } {
  return { dateFrom: shiftIsoDate(today, -(DEFAULT_RANGE_DAYS - 1)), dateTo: today };
}

function validRange(from: string, to: string): boolean {
  const span = daysBetween(from, to);
  return span >= 0 && span < MAX_RANGE_DAYS;
}

/** Strict validation for server-action input. */
export const transactionQuerySchema = z
  .object({
    dateFrom: z.string().refine((s) => isIsoDate(s)),
    dateTo: z.string().refine((s) => isIsoDate(s)),
    status: z.enum(TRANSACTION_STATUSES).optional(),
    ...pageFields,
  })
  .refine((q) => validRange(q.dateFrom, q.dateTo), { message: 'invalid range', path: ['dateTo'] });

/** Lenient URL parsing: invalid pieces fall back to defaults instead of erroring. */
export function parseTransactionParams(sp: RawSearchParams, today: string): TransactionQuery {
  const { page, pageSize } = parsePageParams(sp);
  const fallback = defaultTransactionRange(today);
  const rawFrom = firstParam(sp.from);
  const rawTo = firstParam(sp.to);
  let dateFrom = isIsoDate(rawFrom) ? rawFrom : fallback.dateFrom;
  let dateTo = isIsoDate(rawTo) ? rawTo : fallback.dateTo;
  if (!validRange(dateFrom, dateTo)) ({ dateFrom, dateTo } = fallback);
  const rawStatus = firstParam(sp.status);
  const status = TRANSACTION_STATUSES.find((s) => s === rawStatus);
  return { dateFrom, dateTo, ...(status ? { status } : {}), page, pageSize };
}

/** Filters to carry in pagination links (built from the validated query, never raw URL input). */
export function transactionLinkParams(q: TransactionQuery): Record<string, string> {
  return { from: q.dateFrom, to: q.dateTo, ...(q.status ? { status: q.status } : {}) };
}

/**
 * Half-open UTC interval [start, end) covering Caracas days dateFrom..dateTo.
 * Venezuela is UTC-4 all year (no DST since 2016).
 */
export function caracasDayBoundsUtc(dateFrom: string, dateTo: string): { startIso: string; endIso: string } {
  return {
    startIso: new Date(`${dateFrom}T00:00:00-04:00`).toISOString(),
    endIso: new Date(`${shiftIsoDate(dateTo, 1)}T00:00:00-04:00`).toISOString(),
  };
}

export function summarizeTransactions(
  rows: Pick<TransactionRow, 'status' | 'total_usd' | 'total_ves'>[],
): TransactionTotals {
  let collectedUsd = 0;
  let collectedVes = 0;
  let collectedCount = 0;
  let pendingUsd = 0;
  let pendingCount = 0;
  for (const r of rows) {
    if (r.status === 'confirmed' || r.status === 'checked_in') {
      collectedUsd += Number(r.total_usd);
      collectedVes += Number(r.total_ves ?? 0);
      collectedCount += 1;
    } else if (r.status === 'pending_payment') {
      pendingUsd += Number(r.total_usd);
      pendingCount += 1;
    }
  }
  return {
    collectedUsd: roundMoney(collectedUsd),
    collectedVes: roundMoney(collectedVes),
    collectedCount,
    pendingUsd: roundMoney(pendingUsd),
    pendingCount,
  };
}
