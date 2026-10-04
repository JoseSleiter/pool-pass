// src/lib/db/audit-search.ts
import { serviceClient } from './service-client';
import { pageRange } from './paginate';
import type { AuditAction, AuditRow } from '@/lib/audit';

function filtered(action: AuditAction | undefined, head: boolean) {
  let query = serviceClient().from('audit_log').select('*', { count: 'exact', head });
  if (action) query = query.eq('action', action);
  return query;
}

/**
 * Audit log, newest first, optionally narrowed to one action. Same ordering as
 * listAudit. Caller must validate input (auditQuerySchema) and require an owner.
 */
export async function searchAudit(p: {
  page: number;
  pageSize: number;
  action?: AuditAction;
}): Promise<{ rows: AuditRow[]; total: number }> {
  const { from, to } = pageRange(p.page, p.pageSize);
  const { data, count, error } = await filtered(p.action, false)
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (error?.code === 'PGRST103') {
    const head = await filtered(p.action, true);
    if (head.error) throw new Error(head.error.message);
    return { rows: [], total: head.count ?? 0 };
  }
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as AuditRow[], total: count ?? 0 };
}
