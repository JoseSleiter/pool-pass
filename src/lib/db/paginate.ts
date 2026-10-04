import { serviceClient } from './service-client';

export const MAX_PAGE_SIZE = 100;

/** 1-based page → inclusive PostgREST range. Throws RangeError on bad input. */
export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  if (!Number.isInteger(page) || page < 1) throw new RangeError(`invalid page: ${page}`);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(`invalid pageSize: ${pageSize}`);
  }
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export interface OrderBy {
  column: string;
  ascending: boolean;
}

/**
 * Paginated `select *` over a service-role table with the exact total.
 * A page past the end returns `rows: []` with the real total: PostgREST
 * answers an unsatisfiable range with error PGRST103 when count=exact.
 */
export async function paginate<T>(
  table: string,
  order: OrderBy[],
  page: number,
  pageSize: number,
): Promise<{ rows: T[]; total: number }> {
  const { from, to } = pageRange(page, pageSize);
  const db = serviceClient();
  let query = db.from(table).select('*', { count: 'exact' });
  for (const o of order) query = query.order(o.column, { ascending: o.ascending });
  const { data, error, count } = await query.range(from, to);
  if (error && error.code === 'PGRST103') {
    const head = await db.from(table).select('*', { count: 'exact', head: true });
    if (head.error) throw new Error(head.error.message);
    return { rows: [], total: head.count ?? 0 };
  }
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as T[], total: count ?? 0 };
}
