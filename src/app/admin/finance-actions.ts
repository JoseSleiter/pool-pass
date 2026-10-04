// src/app/admin/finance-actions.ts
'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { searchTransactions, transactionTotals } from '@/lib/db/transactions';
import { searchAudit } from '@/lib/db/audit-search';
import { listBcvHistory } from '@/lib/bcv-history';
import { pageQuerySchema } from '@/lib/admin-page-params';
import {
  transactionQuerySchema, type TransactionRow, type TransactionTotals,
} from '@/lib/finance/transactions';
import { withVariation, type BcvRowWithVariation } from '@/lib/finance/bcv';
import { auditQuerySchema } from '@/lib/audit-labels';
import type { AuditRow } from '@/lib/audit';

/**
 * Read-only finance + audit listings (PR 12). Every function gates itself and
 * validates its input: pages call them, but they are reachable as server
 * actions too. They never write, so there is nothing to audit.
 */

export interface TransactionsPageData {
  rows: TransactionRow[];
  total: number;
  /** For the whole date range (status filter not applied). */
  totals: TransactionTotals;
}

export async function adminListTransactions(raw: unknown): Promise<TransactionsPageData> {
  await requireAdmin();
  const parsed = transactionQuerySchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid query');
  const q = parsed.data;
  const [page, totals] = await Promise.all([
    searchTransactions(q),
    transactionTotals({ dateFrom: q.dateFrom, dateTo: q.dateTo }),
  ]);
  return { ...page, totals };
}

export async function adminBcvHistoryPage(
  raw: unknown,
): Promise<{ rows: BcvRowWithVariation[]; total: number }> {
  await requireAdmin();
  const parsed = pageQuerySchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid page');
  const { page, pageSize } = parsed.data;
  const { rows, total } = await listBcvHistory({ page, pageSize });
  // The rate just older than this page's last row is the first row of the next
  // page. With 1-row pages, page N is row N, so fetch exactly that row.
  const olderPosition = page * pageSize + 1;
  const older = rows.length === pageSize && olderPosition <= total
    ? (await listBcvHistory({ page: olderPosition, pageSize: 1 })).rows[0] ?? null
    : null;
  return { rows: withVariation(rows, older), total };
}

export async function adminSearchAudit(raw: unknown): Promise<{ rows: AuditRow[]; total: number }> {
  await requireAdmin({ role: 'owner' });
  const parsed = auditQuerySchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid query');
  return searchAudit(parsed.data);
}
