import { serviceClient } from '@/lib/db/service-client';
import { paginate } from '@/lib/db/paginate';

/** What triggered the fetch: app traffic ('auto') or the admin refresh button ('manual'). */
export type BcvRateSource = 'auto' | 'manual';

export interface BcvHistoryRow {
  id: number;
  fetched_at: string;
  rate: number;
  source: string | null;
}

/** Appends one freshly fetched rate. Throws on DB error (callers decide). */
export async function recordBcvRate(rate: number, fetchedAt: number, source: BcvRateSource): Promise<void> {
  const { error } = await serviceClient()
    .from('bcv_rate_history')
    .insert({ rate, fetched_at: new Date(fetchedAt).toISOString(), source });
  if (error) throw new Error(error.message);
}

/** Newest first. `page` is 1-based; `pageSize` 1–100. */
export async function listBcvHistory(p: { page: number; pageSize: number }): Promise<{ rows: BcvHistoryRow[]; total: number }> {
  const { rows, total } = await paginate<BcvHistoryRow>(
    'bcv_rate_history',
    [{ column: 'fetched_at', ascending: false }, { column: 'id', ascending: false }],
    p.page,
    p.pageSize,
  );
  return { rows: rows.map((r) => ({ ...r, rate: Number(r.rate) })), total };
}
