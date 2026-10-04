import { serviceClient } from '@/lib/db/service-client';
import { paginate } from '@/lib/db/paginate';

export type AuditAction =
  | 'reservation.check_in' | 'reservation.resend_voucher'
  | 'settings.update' | 'override.upsert' | 'override.delete'
  | 'role.upsert'
  | 'bcv.refresh';

export interface AuditRow {
  id: number;
  at: string;
  actor_email: string;
  action: AuditAction;
  target: string | null;
  details: Record<string, unknown>;
}

/**
 * Records an admin action. NEVER throws: auditing must not break the action
 * it describes, so any failure is only reported via console.error.
 */
export async function logAudit(e: {
  actor: string;
  action: AuditAction;
  target?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await serviceClient().from('audit_log').insert({
      actor_email: e.actor,
      action: e.action,
      target: e.target ?? null,
      details: e.details ?? {},
    });
    if (error) console.error('audit: insert failed:', error.message);
  } catch (err) {
    console.error('audit: insert threw:', err);
  }
}

/** Newest first. `page` is 1-based; `pageSize` 1–100. */
export async function listAudit(p: { page: number; pageSize: number }): Promise<{ rows: AuditRow[]; total: number }> {
  return paginate<AuditRow>(
    'audit_log',
    [{ column: 'at', ascending: false }, { column: 'id', ascending: false }],
    p.page,
    p.pageSize,
  );
}
