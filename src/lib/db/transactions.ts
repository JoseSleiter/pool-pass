// src/lib/db/transactions.ts
import { serviceClient } from './service-client';
import { pageRange } from './paginate';
import {
  TRANSACTION_STATUSES, caracasDayBoundsUtc, summarizeTransactions,
  type TransactionQuery, type TransactionRow, type TransactionTotals,
} from '@/lib/finance/transactions';

/** Explicit list so rows match TransactionRow exactly (no PII beyond the name). */
const TRANSACTION_COLUMNS =
  'id, code, first_name, last_name, total_usd, bcv_rate, total_ves, status, payment_ref, checked_in_at, created_at';

function filtered(q: Pick<TransactionQuery, 'dateFrom' | 'dateTo' | 'status'>, head: boolean) {
  const { startIso, endIso } = caracasDayBoundsUtc(q.dateFrom, q.dateTo);
  return serviceClient()
    .from('reservations')
    .select(TRANSACTION_COLUMNS, { count: 'exact', head })
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .in('status', q.status ? [q.status] : [...TRANSACTION_STATUSES]);
}

/**
 * C2P transactions created in [dateFrom, dateTo] (Caracas days), newest first.
 * Caller must validate `q` (transactionQuerySchema) and gate on requireAdmin().
 */
export async function searchTransactions(
  q: TransactionQuery,
): Promise<{ rows: TransactionRow[]; total: number }> {
  const { from, to } = pageRange(q.page, q.pageSize);
  const { data, count, error } = await filtered(q, false)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true }) // unique tiebreaker keeps pages stable
    .range(from, to);

  // PostgREST answers PGRST103 when the offset is past the last row (count=exact).
  if (error?.code === 'PGRST103') {
    const head = await filtered(q, true);
    if (head.error) throw new Error(head.error.message);
    return { rows: [], total: head.count ?? 0 };
  }
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as TransactionRow[], total: count ?? 0 };
}

/** PostgREST caps every response at max_rows (1000 in supabase/config.toml). */
export const TOTALS_CHUNK = 1000;

/**
 * Collected / pending totals for the whole range (status filter not applied).
 * Reads in chunks so a busy range is never silently truncated by max_rows.
 */
export async function transactionTotals(
  range: { dateFrom: string; dateTo: string },
  chunkSize: number = TOTALS_CHUNK,
): Promise<TransactionTotals> {
  const { startIso, endIso } = caracasDayBoundsUtc(range.dateFrom, range.dateTo);
  const rows: Pick<TransactionRow, 'status' | 'total_usd' | 'total_ves'>[] = [];
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await serviceClient()
      .from('reservations')
      .select('status, total_usd, total_ves')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .in('status', ['confirmed', 'checked_in', 'pending_payment'])
      .order('id', { ascending: true })
      .range(from, from + chunkSize - 1);
    if (error?.code === 'PGRST103') break; // offset past the end
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as Pick<TransactionRow, 'status' | 'total_usd' | 'total_ves'>[];
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }
  return summarizeTransactions(rows);
}
